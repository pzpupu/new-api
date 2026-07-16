package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseUserReportKey(t *testing.T) {
	cases := []struct {
		name     string
		key      string
		wantOk   bool
		wantTok  int
		wantDate string
	}{
		{"valid", "user-reports/12/34/2026-07-15.json", true, 34, "2026-07-15"},
		{"wrong prefix", "reports/12/34/2026-07-15.json", false, 0, ""},
		{"missing segment", "user-reports/12/2026-07-15.json", false, 0, ""},
		{"extra segment", "user-reports/12/34/sub/2026-07-15.json", false, 0, ""},
		{"non-int token", "user-reports/12/abc/2026-07-15.json", false, 0, ""},
		{"no json suffix", "user-reports/12/34/2026-07-15.txt", false, 0, ""},
		{"bad date short", "user-reports/12/34/2026-7-1.json", false, 0, ""},
		{"empty date", "user-reports/12/34/.json", false, 0, ""},
		{"path traversal", "user-reports/12/34/../../etc.json", false, 0, ""},
		{"prefix dir only", "user-reports/12/34/", false, 0, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			entry, ok := parseUserReportKey(tc.key)
			require.Equal(t, tc.wantOk, ok)
			if tc.wantOk {
				assert.Equal(t, tc.wantTok, entry.TokenId)
				assert.Equal(t, tc.wantDate, entry.Date)
				assert.Equal(t, tc.key, entry.Key)
			}
		})
	}
}

// date 是拼接 S3 key 前唯一的用户可控字符串，这里锁住它只接受严格 YYYY-MM-DD，
// 拒绝任何可能导致路径穿越 / 非法 key 的输入。
func TestUserReportDateValidation(t *testing.T) {
	valid := []string{"2026-07-15", "2000-01-01", "1999-12-31"}
	for _, d := range valid {
		assert.Truef(t, userReportDateRe.MatchString(d), "expected valid date: %q", d)
	}

	invalid := []string{
		"", "2026-7-1", "2026/07/15", "../../etc", "2026-07-15/x",
		"2026-07-15.json", "abcd-ef-gh", "20260715", " 2026-07-15", "2026-07-15 ",
	}
	for _, d := range invalid {
		assert.Falsef(t, userReportDateRe.MatchString(d), "expected invalid date: %q", d)
	}
}
