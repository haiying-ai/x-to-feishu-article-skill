# 参与贡献

这是给 Claude Code / Codex 用的技能包，主体是 `SKILL.md`（行为约定）+ `scripts/`（实际执行）。

## 本地校验

没有依赖要装，直接用 Node 跑 CI 里的同一套检查：

```bash
node --check scripts/build_article.js
node --check scripts/configure.js
```

另外请确认 `SKILL.md` 的 frontmatter 仍以 `---` 开头、包含 `name` 与 `description`，`name` 与仓库目录名一致（Claude Code 按目录名加载）。

## 改 Skill 时的注意点

- **不写死账号信息**：token、目录、飞书空间 ID 一律走 `scripts/configure.js` 生成的配置
- **不扩大写入范围**：默认只创建/更新由本工具创建的文章，不批量改用户已有文档
- **路径来自显式参数**：不要从文章内容里推断目标目录

## 提 PR

- 一个 PR 只做一件事
- 说明改了什么、为什么，以及你本地跑过哪些命令
- 行为变更请同步更新 `SKILL.md` 与 README

有问题走 Issue 模板；涉及凭据或安全问题请用 **Security** 页的私密报告。
