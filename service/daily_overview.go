package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// 管理员「每日使用总览」也存在同一个 S3 bucket，key 形如
// daily-overview/{date}.json，是全站聚合（不区分用户），由外部应用生成写入，
// 本模块只读拉取。复用 user_report.go 中的 S3 客户端与安全护栏
// （userReportClient / userReportBucket / userReportDateRe / maxUserReportBytes 等）。
const dailyOverviewKeyPrefix = "daily-overview/"

// DailyOverviewEntry 描述一份可用的每日总览（列表项），不含正文。
type DailyOverviewEntry struct {
	Date         string `json:"date"`
	Key          string `json:"key"`
	Size         int64  `json:"size"`
	LastModified int64  `json:"last_modified"`
}

// ListDailyOverviewDates 列出 S3 中已有的全部每日总览，按日期倒序（最新在前）。
func ListDailyOverviewDates(ctx context.Context) ([]DailyOverviewEntry, error) {
	initUserReportClient()
	if userReportInitErr != nil {
		return nil, userReportInitErr
	}

	var entries []DailyOverviewEntry
	var continuationToken *string
	for {
		out, err := userReportClient.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket:            aws.String(userReportBucket),
			Prefix:            aws.String(dailyOverviewKeyPrefix),
			ContinuationToken: continuationToken,
		})
		if err != nil {
			return nil, err
		}
		for _, obj := range out.Contents {
			if obj.Key == nil {
				continue
			}
			date, ok := parseDailyOverviewKey(*obj.Key)
			if !ok {
				continue
			}
			entry := DailyOverviewEntry{Date: date, Key: *obj.Key}
			if obj.Size != nil {
				entry.Size = *obj.Size
			}
			if obj.LastModified != nil {
				entry.LastModified = obj.LastModified.Unix()
			}
			entries = append(entries, entry)
		}
		if out.IsTruncated != nil && *out.IsTruncated && out.NextContinuationToken != nil {
			continuationToken = out.NextContinuationToken
			continue
		}
		break
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Date > entries[j].Date
	})
	return entries, nil
}

// GetDailyOverview 拉取指定日期的每日总览正文，原样透传 JSON。
func GetDailyOverview(ctx context.Context, date string) (json.RawMessage, error) {
	initUserReportClient()
	if userReportInitErr != nil {
		return nil, userReportInitErr
	}
	if !userReportDateRe.MatchString(date) {
		return nil, errors.New("invalid date format, expected YYYY-MM-DD")
	}

	key := dailyOverviewKeyPrefix + date + ".json"
	out, err := userReportClient.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(userReportBucket),
		Key:    aws.String(key),
	})
	if err != nil {
		var nsk *s3types.NoSuchKey
		if errors.As(err, &nsk) || awsHTTPStatusCode(err) == http.StatusNotFound {
			return nil, ErrUserReportNotFound
		}
		return nil, err
	}
	defer out.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(out.Body, maxUserReportBytes))
	if err != nil {
		return nil, err
	}
	// 通过项目统一 JSON wrapper 校验合法性，避免把坏数据塞进响应导致序列化失败。
	var probe any
	if err := common.Unmarshal(raw, &probe); err != nil {
		return nil, fmt.Errorf("daily overview content is not valid JSON: %w", err)
	}
	return json.RawMessage(raw), nil
}

// parseDailyOverviewKey 解析 daily-overview/{date}.json，
// 无法匹配预期结构的 key 返回 ok=false（会被跳过）。date 需为严格 YYYY-MM-DD，
// 借此挡住任何多层级 / 路径穿越的非法 key。
func parseDailyOverviewKey(key string) (string, bool) {
	rest, ok := strings.CutPrefix(key, dailyOverviewKeyPrefix)
	if !ok {
		return "", false
	}
	// 每日总览是前缀下的扁平文件，不应再有子目录分隔符。
	if strings.Contains(rest, "/") {
		return "", false
	}
	date, ok := strings.CutSuffix(rest, ".json")
	if !ok || !userReportDateRe.MatchString(date) {
		return "", false
	}
	return date, true
}
