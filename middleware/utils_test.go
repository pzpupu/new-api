package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestAbortWithOpenAIMessageGroupLogging(t *testing.T) {
	var logBuffer bytes.Buffer

	common.LogWriterMu.Lock()
	oldWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logBuffer
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = oldWriter
		common.LogWriterMu.Unlock()
	})

	testCases := []struct {
		name            string
		usingGroup      string
		autoGroup       string
		userGroup       string
		expectedLog     string
		unexpectedGroup string
	}{
		{
			name:        "using group",
			usingGroup:  "cc",
			expectedLog: "| user 14 | group cc | relay_error | status code: 410",
		},
		{
			name:            "auto group overrides generic using group",
			usingGroup:      "auto",
			autoGroup:       "cc",
			expectedLog:     "| user 14 | group cc | relay_error | status code: 410",
			unexpectedGroup: "| group auto |",
		},
		{
			name:        "user group fallback",
			userGroup:   "cc",
			expectedLog: "| user 14 | group cc | relay_error | status code: 410",
		},
		{
			name:            "missing group preserves legacy format",
			expectedLog:     "| user 14 | relay_error | status code: 410",
			unexpectedGroup: "| group ",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			logBuffer.Reset()
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			common.SetContextKey(ctx, constant.ContextKeyUserId, 14)
			common.SetContextKey(ctx, constant.ContextKeyUsingGroup, testCase.usingGroup)
			common.SetContextKey(ctx, constant.ContextKeyAutoGroup, testCase.autoGroup)
			common.SetContextKey(ctx, constant.ContextKeyUserGroup, testCase.userGroup)

			abortWithOpenAiMessage(ctx, http.StatusGone, "relay_error | status code: 410")

			logOutput := logBuffer.String()
			require.Contains(t, logOutput, testCase.expectedLog)
			if testCase.unexpectedGroup != "" {
				require.NotContains(t, logOutput, testCase.unexpectedGroup)
			}
		})
	}
}
