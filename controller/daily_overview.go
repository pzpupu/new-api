package controller

import (
	"context"
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// GetDailyOverviews 列出 S3 中已有的每日总览日期（仅管理员）。
// 超时复用 user_report.go 的 userReportS3Timeout。
func GetDailyOverviews(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), userReportS3Timeout)
	defer cancel()
	entries, err := service.ListDailyOverviewDates(ctx)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    entries,
	})
}

// GetDailyOverviewContent 拉取某天的每日总览正文，原样透传 JSON（仅管理员）。
func GetDailyOverviewContent(c *gin.Context) {
	date := c.Query("date")

	ctx, cancel := context.WithTimeout(c.Request.Context(), userReportS3Timeout)
	defer cancel()
	content, err := service.GetDailyOverview(ctx, date)
	if err != nil {
		// 总览不存在属于正常空态，返回 data:null 让前端渲染空状态，而不是弹错误。
		if errors.Is(err, service.ErrUserReportNotFound) {
			c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": nil})
			return
		}
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    content,
	})
}
