package middleware

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"
)

var client *tos.ClientV2
var ctx = context.Background()
var bucketName string
var prefix = "newapi_logs"

func TosInit() {
	var (
		ak = os.Getenv("TOS_ACCESS_KEY")
		sk = os.Getenv("TOS_SECRET_KEY")
		// endpoint 若没有指定 HTTP 协议（HTTP/HTTPS），默认使用 HTTPS
		endpoint = os.Getenv("TOS_ENDPOINT")
		region   = os.Getenv("TOS_REGION")
	)
	bucketName = os.Getenv("TOS_BUCKET")
	prefix = os.Getenv("TOS_PREFIX")

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

// readRequestBody 完整读取请求体内容
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

func TosLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		if nil != client &&
			(strings.HasPrefix(c.Request.URL.Path, "/v1/chat/completions") ||
				strings.HasPrefix(c.Request.URL.Path, "/pg/chat/completions") ||
				strings.HasPrefix(c.Request.URL.Path, "/v1/responses") ||
				strings.HasPrefix(c.Request.URL.Path, "/v1/messages") ||
				strings.HasPrefix(c.Request.URL.Path, "/v1beta/models")) {

			// 创建自定义 ResponseWriter 来捕获响应（支持流式响应）
			bodyWriter := &responseBodyWriter{
				ResponseWriter: c.Writer,
				body:           &bytes.Buffer{},
				writeCount:     0,
			}
			c.Writer = bodyWriter

			// 执行请求处理
			c.Next()

			// === 请求后 - 记录数据 ===
			content := make(map[string]interface{})
			content["username"] = c.GetString("username")
			content["user_id"] = c.GetInt("id")
			content["group"] = c.GetString("group")
			content["user_group"] = c.GetString("user_group")
			content["token_name"] = c.GetString("token_name")
			content["channel_id"] = c.GetInt("channel_id")
			content["channel_name"] = c.GetString("channel_name")
			content["original_model"] = c.GetString("original_model")
			content["model_mapping"] = c.GetString("model_mapping")
			content["request_id"] = c.GetString(common.RequestIdKey)
			content["request_path"] = c.Request.URL.Path

			contentType := c.Writer.Header().Get("Content-Type")
			isStreaming := bodyWriter.writeCount > 1 || isStreamingContentType(contentType)
			content["is_streaming"] = isStreaming

			requestBody := readRequestBody(c)
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

			requestId := content["request_id"].(string)
			// 20251110 修改为按天存储
			requestIdDate := requestId[:8]
			path := prefix + "/" + requestIdDate + "/" + requestId + ".json"

			gopool.Go(func() {
				output, err := client.PutObjectV2(ctx, &tos.PutObjectV2Input{
					PutObjectBasicInput: tos.PutObjectBasicInput{
						Bucket: bucketName,
						Key:    path,
					},
					// Fix: Marshal now returns ([]byte, error); handle error first
					Content: func() io.ReadCloser {
						data, err := common.Marshal(content)
						if err != nil {
							logger.LogError(c, "Failed to marshal content: "+err.Error())
							data = []byte("{}")
						}
						return io.NopCloser(bytes.NewReader(data))
					}(),
				})
				if err != nil {
					logger.LogError(c, "Failed to put object: "+err.Error())
				}
				logger.LogInfo(c, fmt.Sprintf("TOS PutObjectV2 Request ID: %s, Path: %s", output.RequestID, path))
			})
		} else {
			// 执行请求处理
			c.Next()
		}

	}
}
