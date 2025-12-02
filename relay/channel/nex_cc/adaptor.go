package nex_cc

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	RequestModeCompletion = 1
	RequestModeMessage    = 2
)

// generateUserID 生成32字节的随机hex字符串
func generateUserID() string {
	bytes := make([]byte, 32)
	_, err := rand.Read(bytes)
	if err != nil {
		// 如果随机数生成失败，使用UUID作为fallback
		return strings.ReplaceAll(uuid.New().String(), "-", "") + strings.ReplaceAll(uuid.New().String(), "-", "")
	}
	return hex.EncodeToString(bytes)
}

// generateSessionID 生成会话ID
func generateSessionID() string {
	return uuid.New().String()
}

// generateMetadata 生成包含user_id的metadata
func generateMetadata() map[string]string {
	userID := generateUserID()
	sessionID := generateSessionID()
	return map[string]string{
		"user_id": fmt.Sprintf("%s_%s", userID, sessionID),
	}
}

type Adaptor struct {
	RequestMode int
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	// 处理 System 字段
	a.processClaudeCodeSystemPrompt(c, request)

	// 修复 System 的 cache_control 格式
	a.fixSystemCacheControl(c.Request.Context(), request)

	// 过滤请求字段
	a.filterRequestFields(request)

	// 为用户消息的最后一个消息添加cache_control
	if result := a.addCacheControl(c.Request.Context(), request.Messages); result != nil {
		if messages, ok := result.([]dto.ClaudeMessage); ok {
			request.Messages = messages
		}
	}

	// 添加metadata（如果不存在）
	a.addMetadataIfMissing(request)

	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	if strings.HasPrefix(info.UpstreamModelName, "claude-2") || strings.HasPrefix(info.UpstreamModelName, "claude-instant") {
		a.RequestMode = RequestModeCompletion
	} else {
		a.RequestMode = RequestModeMessage
	}
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if a.RequestMode == RequestModeMessage {
		return fmt.Sprintf("%s/v1/messages", info.ChannelBaseUrl), nil
	} else {
		return fmt.Sprintf("%s/v1/complete", info.ChannelBaseUrl), nil
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)

	req.Set("Authorization", "Bearer "+info.ApiKey)

	// Add additional headers
	anthropicVersion := c.Request.Header.Get("anthropic-version")
	if anthropicVersion == "" {
		anthropicVersion = "2023-06-01"
	}
	req.Set("anthropic-version", anthropicVersion)

	req.Set("anthropic-beta", "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14")
	req.Set("anthropic-dangerous-direct-browser-access", "true")
	req.Set("content-type", "application/json")
	req.Set("Accept", "application/json")
	req.Set("user-agent", "claude-cli/1.0.93 (external, cli)")
	req.Set("x-app", "cli")
	req.Set("x-stainless-arch", "x64")
	req.Set("x-stainless-helper-method", "stream")
	req.Set("x-stainless-lang", "js")
	req.Set("x-stainless-os", "Linux")
	req.Set("x-stainless-package-version", "0.55.1")
	req.Set("x-stainless-retry-count", "0")
	req.Set("x-stainless-runtime", "node")
	req.Set("x-stainless-runtime-version", "v18.20.8")
	req.Set("x-stainless-timeout", "600")
	req.Set("accept-language", "*")
	req.Set("sec-fetch-mode", "cors")
	req.Set("accept-encoding", "gzip, deflate")

	model_setting.GetClaudeSettings().WriteHeaders(info.OriginModelName, req)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	var convertedRequest any
	var err error

	if a.RequestMode == RequestModeCompletion {
		convertedRequest = RequestOpenAI2ClaudeComplete(*request)
	} else {
		convertedRequest, err = RequestOpenAI2ClaudeMessage(c, *request)
		if err != nil {
			return nil, err
		}
	}

	return convertedRequest, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.IsStream {
		return ClaudeStreamHandler(c, resp, info, a.RequestMode)
	} else {
		return ClaudeHandler(c, resp, info, a.RequestMode)
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

// filterRequestFields 过滤掉指定的字段
func (a *Adaptor) filterRequestFields(request *dto.ClaudeRequest) {
	// 强制抹平
	request.TopK = 0
	request.TopP = 0
	request.Temperature = nil
}

// fixSystemCacheControl 修复 System 字段中的 cache_control 格式
func (a *Adaptor) fixSystemCacheControl(ctx context.Context, request *dto.ClaudeRequest) {
	if request.System == nil {
		return
	}

	// 处理 []map[string]interface{} 类型
	if systemSlice, ok := request.System.([]map[string]interface{}); ok {
		for i, systemItem := range systemSlice {
			if cacheControlInterface, exists := systemItem["cache_control"]; exists {
				if cacheControlMap, ok := cacheControlInterface.(map[string]interface{}); ok {
					if cacheControlMap["type"] == "ephemeral" && cacheControlMap["ttl"] == nil {
						// 需要修复格式
						systemSlice[i]["cache_control"] = map[string]string{"type": "ephemeral", "ttl": "1h"}
						common.SysLog(fmt.Sprintf("Fixed cache_control format in system item %d", i))
					}
				}
			}
		}
		request.System = systemSlice
	} else if systemInterfaceSlice, ok := request.System.([]interface{}); ok {
		// 处理 []interface{} 类型
		for i, systemItem := range systemInterfaceSlice {
			if systemMap, ok := systemItem.(map[string]interface{}); ok {
				if cacheControlInterface, exists := systemMap["cache_control"]; exists {
					if cacheControlMap, ok := cacheControlInterface.(map[string]interface{}); ok {
						if cacheControlMap["type"] == "ephemeral" && cacheControlMap["ttl"] == nil {
							// 需要修复格式
							systemMap["cache_control"] = map[string]string{"type": "ephemeral", "ttl": "1h"}
							common.SysLog(fmt.Sprintf("Fixed cache_control format in system item %d", i))
						}
					}
				}
			}
		}
		request.System = systemInterfaceSlice
	}
}

// addCacheControl 修复所有消息的cache_control格式，并为最后一个用户消息添加cache_control
func (a *Adaptor) addCacheControl(ctx context.Context, messages interface{}) interface{} {
	if messages == nil {
		return messages
	}

	// 创建cache_control JSON
	cacheControlData, _ := json.Marshal(map[string]string{"type": "ephemeral", "ttl": "1h"})

	// 处理 []dto.ClaudeMessage 类型 (用户消息)
	if claudeMessages, ok := messages.([]dto.ClaudeMessage); ok {
		if len(claudeMessages) == 0 {
			return claudeMessages
		}

		// 修复所有消息的cache_control格式
		for i := 0; i < len(claudeMessages); i++ {
			message := &claudeMessages[i]
			a.fixCacheControlFormat(ctx, message, i, false)
		}

		// 为最后一个用户消息添加cache_control（如果还没有的话）
		for i := len(claudeMessages) - 1; i >= 0; i-- {
			message := &claudeMessages[i]
			if message.Role == "user" {
				a.addCacheControlToMessage(ctx, message, i, cacheControlData)
				break
			}
		}

		return claudeMessages
	}

	return messages
}

// fixCacheControlFormat 修复消息中cache_control的格式
func (a *Adaptor) fixCacheControlFormat(ctx context.Context, message *dto.ClaudeMessage, messageIndex int, isLastUserMessage bool) {
	if contentArray, ok := message.Content.([]dto.ClaudeMediaMessage); ok {
		// 处理强类型数组
		for j, content := range contentArray {
			if len(content.CacheControl) > 0 {
				// 检查是否需要修复格式
				var existingCacheControl map[string]interface{}
				if err := json.Unmarshal(content.CacheControl, &existingCacheControl); err == nil {
					if existingCacheControl["type"] == "ephemeral" && existingCacheControl["ttl"] == nil {
						// 需要修复格式
						fixedCacheControl := map[string]string{"type": "ephemeral", "ttl": "1h"}
						if fixedData, err := json.Marshal(fixedCacheControl); err == nil {
							contentArray[j].CacheControl = fixedData
							common.SysLog(fmt.Sprintf("Fixed cache_control format in message %d, content %d", messageIndex, j))
						}
					}
				}
			}
		}
		message.Content = contentArray
	} else if contentInterfaceArray, ok := message.Content.([]interface{}); ok {
		// 处理 JSON 反序列化后的 []interface{} 类型
		for j, contentItem := range contentInterfaceArray {
			if contentMap, ok := contentItem.(map[string]interface{}); ok {
				if cacheControlInterface, exists := contentMap["cache_control"]; exists {
					if cacheControlMap, ok := cacheControlInterface.(map[string]interface{}); ok {
						if cacheControlMap["type"] == "ephemeral" && cacheControlMap["ttl"] == nil {
							// 需要修复格式
							contentMap["cache_control"] = map[string]string{"type": "ephemeral", "ttl": "1h"}
							common.SysLog(fmt.Sprintf("Fixed cache_control format in deserialized message %d, content %d", messageIndex, j))
						}
					}
				}
			}
		}
		message.Content = contentInterfaceArray
	}
}

// addCacheControlToMessage 为消息添加cache_control（如果还没有的话）
func (a *Adaptor) addCacheControlToMessage(ctx context.Context, message *dto.ClaudeMessage, messageIndex int, cacheControlData []byte) {
	// 如果是字符串内容，转换为数组格式并添加cache_control
	if content, ok := message.Content.(string); ok {
		contentText := content
		message.Content = []dto.ClaudeMediaMessage{
			{
				Type:         "text",
				Text:         &contentText,
				CacheControl: cacheControlData,
			},
		}
		common.SysLog(fmt.Sprintf("Added cache_control to string message %d", messageIndex))
	} else if contentArray, ok := message.Content.([]dto.ClaudeMediaMessage); ok {
		// 如果是数组内容，为最后一个元素添加cache_control
		if len(contentArray) > 0 {
			lastContentIndex := len(contentArray) - 1
			if len(contentArray[lastContentIndex].CacheControl) == 0 {
				contentArray[lastContentIndex].CacheControl = cacheControlData
				common.SysLog(fmt.Sprintf("Added cache_control to array message %d, content %d", messageIndex, lastContentIndex))
			}
			message.Content = contentArray
		}
	} else if contentInterfaceArray, ok := message.Content.([]interface{}); ok {
		// 处理 JSON 反序列化后的 []interface{} 类型
		if len(contentInterfaceArray) > 0 {
			lastContentIndex := len(contentInterfaceArray) - 1
			if lastContentMap, ok := contentInterfaceArray[lastContentIndex].(map[string]interface{}); ok {
				// 检查是否已经有 cache_control
				if _, exists := lastContentMap["cache_control"]; !exists {
					lastContentMap["cache_control"] = map[string]string{"type": "ephemeral", "ttl": "1h"}
					common.SysLog(fmt.Sprintf("Added cache_control to deserialized message %d, content %d", messageIndex, lastContentIndex))
				}
			}
			message.Content = contentInterfaceArray
		}
	}
}

// processClaudeCodeSystemPrompt 处理 ClaudeRequest 的 System 字段，确保包含 Claude Code 系统提示
func (a *Adaptor) processClaudeCodeSystemPrompt(c *gin.Context, request *dto.ClaudeRequest) {
	defaultSystemMessage := "You are Claude Code, Anthropic's official CLI for Claude."
	claudeCodeSystemPrompt := map[string]interface{}{
		"type": "text",
		"text": defaultSystemMessage,
	}

	if request.System == nil {
		// 如果 system 不存在，则设置为默认内容
		request.System = []map[string]interface{}{claudeCodeSystemPrompt}
	} else {
		// 尝试将 System 转换为 []map[string]interface{} 类型
		if systemSlice, ok := request.System.([]map[string]interface{}); ok {
			if len(systemSlice) == 0 {
				// 如果 system 存在但为空数组，则添加默认内容
				request.System = []map[string]interface{}{claudeCodeSystemPrompt}
			} else {
				// 如果 system 存在且不为空，检查第一条是否为目标内容
				firstMap := systemSlice[0]
				if text, ok := firstMap["text"].(string); !ok || text != defaultSystemMessage {
					// 第一条内容不是目标文本，在开头插入一条
					request.System = append([]map[string]interface{}{claudeCodeSystemPrompt}, systemSlice...)
				}
			}
		} else if systemInterfaceSlice, ok := request.System.([]interface{}); ok {
			// 处理 []interface{} 类型，其中元素为 map[string]interface{}
			if len(systemInterfaceSlice) == 0 {
				// 如果 system 存在但为空数组，则添加默认内容
				request.System = []map[string]interface{}{claudeCodeSystemPrompt}
			} else {
				// 检查第一个元素是否为 map[string]interface{} 且包含目标文本
				if firstMap, ok := systemInterfaceSlice[0].(map[string]interface{}); ok {
					if text, ok := firstMap["text"].(string); !ok || text != defaultSystemMessage {
						convertedSlice := make([]map[string]interface{}, 0, len(systemInterfaceSlice))
						for _, item := range systemInterfaceSlice {
							if itemMap, ok := item.(map[string]interface{}); ok {
								convertedSlice = append(convertedSlice, itemMap)
							}
						}
						request.System = append([]map[string]interface{}{claudeCodeSystemPrompt}, convertedSlice...)
					}
				} else {
					// 第一个元素不是 map[string]interface{} 类型，重新设置为默认内容
					request.System = []map[string]interface{}{claudeCodeSystemPrompt}
				}
			}
		} else if systemMediaSlice, ok := request.System.([]dto.ClaudeMediaMessage); ok {
			// 处理 []dto.ClaudeMediaMessage 类型
			if len(systemMediaSlice) == 0 {
				request.System = []map[string]interface{}{claudeCodeSystemPrompt}
			} else {
				firstText := ""
				if systemMediaSlice[0].Text != nil {
					firstText = *systemMediaSlice[0].Text
				}
				if firstText != defaultSystemMessage {
					// 转换为 []map[string]interface{} 并在开头插入
					newSystem := []map[string]interface{}{claudeCodeSystemPrompt}
					for _, msg := range systemMediaSlice {
						item := map[string]interface{}{
							"type": msg.Type,
						}
						if msg.Text != nil {
							item["text"] = *msg.Text
						}
						if len(msg.CacheControl) > 0 {
							var cc interface{}
							json.Unmarshal(msg.CacheControl, &cc)
							item["cache_control"] = cc
						}
						newSystem = append(newSystem, item)
					}
					request.System = newSystem
				}
			}
		} else if systemString, ok := request.System.(string); ok {
			if systemString != defaultSystemMessage {
				request.System = []map[string]interface{}{claudeCodeSystemPrompt}
			}
		} else {
			// 如果 System 不是预期的类型，重新设置为默认内容
			request.System = []map[string]interface{}{claudeCodeSystemPrompt}
		}
	}
}

// addMetadataIfMissing 如果请求中没有metadata，则添加包含user_id的metadata
func (a *Adaptor) addMetadataIfMissing(request *dto.ClaudeRequest) {
	// 检查是否已经有metadata
	if len(request.Metadata) > 0 {
		// 如果已经有metadata，则不需要添加
		return
	}

	// 生成并设置metadata
	metadata := generateMetadata()
	metadataBytes, _ := json.Marshal(metadata)
	request.Metadata = metadataBytes
}
