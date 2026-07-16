package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// registerUserReportRoutes 注册「用户使用总结」相关路由。
// 路由定义放在独立文件，api-router.go 只需一行调用，尽量少改上游文件。
func registerUserReportRoutes(apiRouter *gin.RouterGroup) {
	r := apiRouter.Group("/user_report")
	r.GET("/self", middleware.UserAuth(), controller.GetUserReportsSelf)
	r.GET("/self/content", middleware.UserAuth(), controller.GetUserReportContentSelf)
	r.GET("", middleware.AdminAuth(), controller.GetUserReports)
	r.GET("/content", middleware.AdminAuth(), controller.GetUserReportContent)
}
