package controller

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStripReportMetadata(t *testing.T) {
	// metadata is removed while sibling fields are preserved.
	withMeta := json.RawMessage(
		`{"usage":{"total_requests":5},"metadata":{"llm_channel_used":"x"},"topic_summary":"y"}`,
	)
	stripped := stripReportMetadata(withMeta)
	var parsed map[string]any
	require.NoError(t, common.Unmarshal(stripped, &parsed))
	_, hasMeta := parsed["metadata"]
	assert.False(t, hasMeta, "metadata must be stripped for non-admins")
	assert.Contains(t, parsed, "usage")
	assert.Contains(t, parsed, "topic_summary")

	// no metadata key -> returned unchanged.
	noMeta := json.RawMessage(`{"usage":{"total_requests":5}}`)
	assert.Equal(t, string(noMeta), string(stripReportMetadata(noMeta)))

	// invalid JSON -> returned unchanged (defensive, never panics).
	bad := json.RawMessage(`not json`)
	assert.Equal(t, string(bad), string(stripReportMetadata(bad)))
}
