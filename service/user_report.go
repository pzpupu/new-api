package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// 用户使用总结报告存储在 S3，key 形如
// user-reports/{user_id}/{token_id}/{date}.json，
// 由外部应用生成写入，本模块只负责只读拉取。
const (
	userReportKeyPrefix = "user-reports/"
	// 单个报告对象的读取上限，防止异常超大对象打爆内存。报告是聚合 JSON，正常很小。
	maxUserReportBytes = 5 << 20 // 5MB
)

// ErrUserReportNotFound 表示对应的报告对象在 S3 中不存在。
var ErrUserReportNotFound = errors.New("user report not found")

// date 必须严格是 YYYY-MM-DD，作为拼接 S3 key 前唯一的用户可控字符串，
// 用它挡住任何路径穿越 / 非法 key。
var userReportDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

var (
	userReportOnce    sync.Once
	userReportClient  *s3.Client
	userReportBucket  string
	userReportInitErr error
)

// initUserReportClient 懒加载 S3 客户端。凭证走环境变量静态密钥
// （复用 relay/channel/aws 中相同的 static credentials 构造方式）。
func initUserReportClient() {
	userReportOnce.Do(func() {
		bucket := common.GetEnvOrDefaultString("S3_BUCKET", "openai-proxy-user-reports")
		region := common.GetEnvOrDefaultString("S3_REGION", "")
		ak := common.GetEnvOrDefaultString("S3_ACCESS_KEY_ID", "")
		sk := common.GetEnvOrDefaultString("S3_SECRET_ACCESS_KEY", "")
		endpoint := common.GetEnvOrDefaultString("S3_ENDPOINT", "")

		if region == "" || ak == "" || sk == "" {
			userReportInitErr = errors.New("user report S3 storage not configured: S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are required")
			return
		}

		opts := s3.Options{
			Region:      region,
			Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(ak, sk, "")),
			HTTPClient:  GetHttpClient(),
		}
		// 自定义 / 兼容 S3（如 MinIO）时需要 path-style 寻址。
		if endpoint != "" {
			opts.BaseEndpoint = aws.String(endpoint)
			opts.UsePathStyle = true
		}
		userReportClient = s3.New(opts)
		userReportBucket = bucket
	})
}

// UserReportEntry 描述一份可用的报告（列表项），不含正文。
type UserReportEntry struct {
	TokenId      int    `json:"token_id"`
	Date         string `json:"date"`
	Key          string `json:"key"`
	Size         int64  `json:"size"`
	LastModified int64  `json:"last_modified"`
}

// ListUserReports 列出某个用户在 S3 中已有的全部报告，按日期倒序（最新在前）。
func ListUserReports(ctx context.Context, userId int) ([]UserReportEntry, error) {
	initUserReportClient()
	if userReportInitErr != nil {
		return nil, userReportInitErr
	}

	prefix := fmt.Sprintf("%s%d/", userReportKeyPrefix, userId)
	var entries []UserReportEntry
	var continuationToken *string
	// ponytail: 全量列出该用户对象；单用户量级（token 数 × 天数）很小。
	// 若未来单用户报告数达到很大规模，再加服务端分页。
	for {
		out, err := userReportClient.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket:            aws.String(userReportBucket),
			Prefix:            aws.String(prefix),
			ContinuationToken: continuationToken,
		})
		if err != nil {
			return nil, err
		}
		for _, obj := range out.Contents {
			if obj.Key == nil {
				continue
			}
			entry, ok := parseUserReportKey(*obj.Key)
			if !ok {
				continue
			}
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
		if entries[i].Date != entries[j].Date {
			return entries[i].Date > entries[j].Date
		}
		return entries[i].TokenId < entries[j].TokenId
	})
	return entries, nil
}

// GetUserReport 拉取指定用户 / token / 日期的报告正文，原样透传 JSON。
func GetUserReport(ctx context.Context, userId, tokenId int, date string) (json.RawMessage, error) {
	initUserReportClient()
	if userReportInitErr != nil {
		return nil, userReportInitErr
	}
	if !userReportDateRe.MatchString(date) {
		return nil, errors.New("invalid date format, expected YYYY-MM-DD")
	}

	key := fmt.Sprintf("%s%d/%d/%s.json", userReportKeyPrefix, userId, tokenId, date)
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
		return nil, fmt.Errorf("report content is not valid JSON: %w", err)
	}
	return json.RawMessage(raw), nil
}

// parseUserReportKey 解析 user-reports/{userId}/{tokenId}/{date}.json，
// 无法匹配预期结构的 key 返回 ok=false（会被跳过）。
func parseUserReportKey(key string) (UserReportEntry, bool) {
	rest, ok := strings.CutPrefix(key, userReportKeyPrefix)
	if !ok {
		return UserReportEntry{}, false
	}
	parts := strings.Split(rest, "/")
	if len(parts) != 3 {
		return UserReportEntry{}, false
	}
	tokenId, err := strconv.Atoi(parts[1])
	if err != nil {
		return UserReportEntry{}, false
	}
	date, ok := strings.CutSuffix(parts[2], ".json")
	if !ok || !userReportDateRe.MatchString(date) {
		return UserReportEntry{}, false
	}
	return UserReportEntry{TokenId: tokenId, Date: date, Key: key}, true
}

// awsHTTPStatusCode 从 AWS SDK 错误中提取 HTTP 状态码（同 relay/channel/aws 的做法）。
func awsHTTPStatusCode(err error) int {
	var httpErr interface{ HTTPStatusCode() int }
	if errors.As(err, &httpErr) {
		return httpErr.HTTPStatusCode()
	}
	return 0
}
