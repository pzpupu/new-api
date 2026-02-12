package middleware

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"
)

var client *tos.ClientV2
var bucketName string
var prefix = "newapi_logs"

// safePathSegmentRegex 匹配不安全的路径字符（仅保留字母、数字、下划线、中横线、点、中文字符）
var safePathSegmentRegex = regexp.MustCompile(`[^a-zA-Z0-9_\p{Han}\-.]`)

func TosInit() {
	var (
		ak = os.Getenv("TOS_ACCESS_KEY")
		sk = os.Getenv("TOS_SECRET_KEY")
		// endpoint 若没有指定 HTTP 协议（HTTP/HTTPS），默认使用 HTTPS
		endpoint = os.Getenv("TOS_ENDPOINT")
		region   = os.Getenv("TOS_REGION")
	)
	bucketName = os.Getenv("TOS_BUCKET")
	// Fix: 仅在环境变量非空时覆盖默认前缀
	if p := os.Getenv("TOS_PREFIX"); p != "" {
		prefix = p
	}

	// 初始化客户端
	var err error
	client, err = tos.NewClientV2(endpoint, tos.WithRegion(region), tos.WithCredentials(tos.NewStaticCredentials(ak, sk)))
	if err != nil {
		common.FatalLog("Failed to create TOS client: %v", err)
	}
}

// responseBodyWriter 用于捕获响应内容的自定义 ResponseWriter
// 支持普通响应和流式响应（SSE、Streaming）
type responseBodyWriter struct {
	gin.ResponseWriter
	body       *bytes.Buffer
	writeCount int // 记录写入次数，用于识别流式响应
}

// Write 重写写入方法，完整捕获响应内容（支持流式写入）
func (w *responseBodyWriter) Write(b []byte) (int, error) {
	w.writeCount++
	// 完整写入到 buffer（流式响应会多次调用此方法）
	w.body.Write(b)
	// 写入原始 ResponseWriter
	return w.ResponseWriter.Write(b)
}

// WriteString 重写字符串写入方法（支持流式写入）
func (w *responseBodyWriter) WriteString(s string) (int, error) {
	w.writeCount++
	// 完整写入到 buffer
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

// isStreamingContentType 判断是否为流式内容类型
func isStreamingContentType(contentType string) bool {
	contentType = strings.ToLower(contentType)
	streamingTypes := []string{
		"text/event-stream",        // SSE
		"application/octet-stream", // 通用流
		"application/x-ndjson",     // Newline Delimited JSON
		"application/stream+json",  // JSON streaming
	}
	for _, st := range streamingTypes {
		if strings.Contains(contentType, st) {
			return true
		}
	}
	return false
}

// readRequestBody 完整读取请求体内容，并恢复请求体供后续处理使用
func readRequestBody(c *gin.Context) string {
	if c.Request.Body == nil {
		return ""
	}

	// 完整读取请求体
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return fmt.Sprintf("[Error reading body: %v]", err)
	}

	// 恢复请求体供后续处理使用
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	return string(bodyBytes)
}

// normalizeJsonString 将 JSON 字符串解析后重新序列化，去除 Unicode 转义
func normalizeJsonString(jsonStr string) interface{} {
	if jsonStr == "" {
		return ""
	}

	// 尝试解析为 JSON 对象
	var jsonObj interface{}
	err := common.Unmarshal([]byte(jsonStr), &jsonObj)
	if err != nil {
		// 如果解析失败，返回原始字符串
		return jsonStr
	}

	// 返回解析后的对象，让外层 Marshal 处理
	return jsonObj
}

// sanitizePathSegment 清理路径段中的不安全字符，仅保留字母、数字、下划线、中横线、点和中文字符
func sanitizePathSegment(s string) string {
	sanitized := safePathSegmentRegex.ReplaceAllString(s, "")
	if sanitized == "" {
		return "_default"
	}
	return sanitized
}

func TosLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		if nil != client &&
			(strings.HasPrefix(c.Request.URL.Path, "/v1/chat/completions") ||
				strings.HasPrefix(c.Request.URL.Path, "/pg/chat/completions") ||
				strings.HasPrefix(c.Request.URL.Path, "/v1/responses") ||
				strings.HasPrefix(c.Request.URL.Path, "/v1/messages") ||
				strings.HasPrefix(c.Request.URL.Path, "/v1beta/models") ||
				strings.HasPrefix(c.Request.URL.Path, "/v1/models")) {

			// Fix: 在 c.Next() 之前读取请求体，确保所有格式（包括 Claude 的 ShouldBindJSON）都能正确捕获
			requestBody := readRequestBody(c)

			// 创建自定义 ResponseWriter 来捕获响应（支持流式响应）
			bodyWriter := &responseBodyWriter{
				ResponseWriter: c.Writer,
				body:           &bytes.Buffer{},
				writeCount:     0,
			}
			c.Writer = bodyWriter

			// 执行请求处理
			c.Next()

			// 只有在启用日志记录时才进行日志存储
			if c.GetBool(common.TosLog) {
				// === 请求后 - 从 context 中提取所有数据（此时 middleware 尚未返回，c 仍然有效）===
				username := c.GetString("username")
				tokenName := c.GetString("token_name")
				requestId := c.GetString(common.RequestIdKey)

				// 安全检查：requestId 必须至少 8 字符用于日期提取
				if requestId == "" || len(requestId) < 8 {
					return
				}

				content := make(map[string]interface{})
				content["username"] = username
				content["user_id"] = c.GetInt("id")
				content["group"] = c.GetString("group")
				content["user_group"] = c.GetString("user_group")
				content["token_name"] = tokenName
				content["channel_id"] = c.GetInt("channel_id")
				content["channel_name"] = c.GetString("channel_name")
				content["original_model"] = c.GetString("original_model")
				content["model_mapping"] = c.GetString("model_mapping")
				content["request_id"] = requestId
				content["request_path"] = c.Request.URL.Path

				contentType := c.Writer.Header().Get("Content-Type")
				isStreaming := bodyWriter.writeCount > 1 || isStreamingContentType(contentType)
				content["is_streaming"] = isStreaming

				// 使用在 c.Next() 之前捕获的请求体
				content["request"] = requestBody

				// 记录完整响应体内容（包括流式响应的所有片段）
				responseBody := bodyWriter.body.String()
				if !isStreaming {
					// 将 JSON 字符串解析为对象，去除 Unicode 转义
					content["response"] = normalizeJsonString(responseBody)
				} else {
					content["response"] = responseBody
				}

				content["errors"] = c.Errors.Errors()

				// 构造存储路径：{prefix}/{username}/{date}/{sanitized_token_name}/{request_id}.json
				requestIdDate := requestId[:8]
				sanitizedTokenName := sanitizePathSegment(tokenName)
				path := prefix + "/" + username + "/" + requestIdDate + "/" + sanitizedTokenName + "/" + requestId + ".json"

				// Fix: 在 goroutine 之前完成 Marshal，避免在异步 goroutine 中使用已回收的 gin.Context
				data, marshalErr := common.Marshal(content)
				if marshalErr != nil {
					common.SysError("Failed to marshal TOS content: " + marshalErr.Error())
					data = []byte("{}")
				}

				gopool.Go(func() {
					// Fix: 使用带超时的 context，防止 TOS 不可用时 goroutine 无限阻塞
					// 设置较长超时（2小时），避免网络波动导致上传失败
					// 注意：TOS 完全不可用时，stuck goroutine 会持有 data 直到超时，可能累积内存
					uploadCtx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
					defer cancel()

					output, uploadErr := client.PutObjectV2(uploadCtx, &tos.PutObjectV2Input{
						PutObjectBasicInput: tos.PutObjectBasicInput{
							Bucket: bucketName,
							Key:    path,
						},
						Content: io.NopCloser(bytes.NewReader(data)),
					})
					// Fix: 错误时 return，防止 output 为 nil 导致 panic
					if uploadErr != nil {
						common.SysError(fmt.Sprintf("Failed to put TOS object: %s, Path: %s", uploadErr.Error(), path))
						return
					}
					common.SysLog(fmt.Sprintf("TOS upload success, RequestID: %s, Path: %s", output.RequestID, path))
				})
			}
		} else {
			// 执行请求处理
			c.Next()
		}
	}
}
