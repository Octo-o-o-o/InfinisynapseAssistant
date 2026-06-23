# Workflow 模板

默认不放活动 workflow，避免对外触发意外 CI。需要时复制启用：

```bash
cp .github/workflows-templates/ci.yml.template .github/workflows/ci.yml
```

`ci.yml.template`：在 push/PR 时跑 `tools/doctor.sh` + `npm test` + skill 镜像一致校验。

业务仓库里对改动文件跑 InfiniSynapse 扫描器的 CI，见 `tools/hooks/examples/github-action-scan.yml`。
