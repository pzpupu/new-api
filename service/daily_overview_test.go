package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseDailyOverviewKey(t *testing.T) {
	cases := []struct {
		name     string
		key      string
		wantOk   bool
		wantDate string
	}{
		{"valid", "daily-overview/2026-07-15.json", true, "2026-07-15"},
		{"wrong prefix", "overview/2026-07-15.json", false, ""},
		{"user report prefix", "user-reports/12/34/2026-07-15.json", false, ""},
		{"nested segment", "daily-overview/sub/2026-07-15.json", false, ""},
		{"no json suffix", "daily-overview/2026-07-15.txt", false, ""},
		{"bad date short", "daily-overview/2026-7-1.json", false, ""},
		{"empty date", "daily-overview/.json", false, ""},
		{"path traversal", "daily-overview/../etc.json", false, ""},
		{"prefix dir only", "daily-overview/", false, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			date, ok := parseDailyOverviewKey(tc.key)
			require.Equal(t, tc.wantOk, ok)
			if tc.wantOk {
				assert.Equal(t, tc.wantDate, date)
			}
		})
	}
}
