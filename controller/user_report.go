package controller

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// 拉取 S3 报告的超时。报告对象很小，单次 List/Get 不应耗时太久。
const userReportS3Timeout = 15 * time.Second

// GetUserReportsSelf 列出当前登录用户自己的报告。
func GetUserReportsSelf(c *gin.Context) {
	listUserReports(c, c.GetInt("id"))
}

// GetUserReports 供管理员按 user_id 列出任意用户的报告。
func GetUserReports(c *gin.Context) {
	userId, err := strconv.Atoi(c.Query("user_id"))
	if err != nil || userId <= 0 {
		common.ApiErrorMsg(c, "invalid user_id")
		return
	}
	listUserReports(c, userId)
}

func listUserReports(c *gin.Context, userId int) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), userReportS3Timeout)
	defer cancel()
	entries, err := service.ListUserReports(ctx, userId)
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

// GetUserReportContentSelf 拉取当前登录用户自己某天某 token 的报告正文。
func GetUserReportContentSelf(c *gin.Context) {
	getUserReportContent(c, c.GetInt("id"))
}

// GetUserReportContent 供管理员按 user_id 拉取任意用户的报告正文。
func GetUserReportContent(c *gin.Context) {
	userId, err := strconv.Atoi(c.Query("user_id"))
	if err != nil || userId <= 0 {
		common.ApiErrorMsg(c, "invalid user_id")
		return
	}
	getUserReportContent(c, userId)
}

func getUserReportContent(c *gin.Context, userId int) {
	tokenId, err := strconv.Atoi(c.Query("token_id"))
	if err != nil || tokenId < 0 {
		common.ApiErrorMsg(c, "invalid token_id")
		return
	}
	date := c.Query("date")

	ctx, cancel := context.WithTimeout(c.Request.Context(), userReportS3Timeout)
	defer cancel()
	content, err := service.GetUserReport(ctx, userId, tokenId, date)
	if err != nil {
		// 报告不存在属于正常空态，返回 data:null 让前端渲染空状态，而不是弹错误。
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
