# DSH 研究：作用域工具解析与权限执行边界

- 状态：源码研究参考；不自动纳入 WEXPC1 正式架构。
- 来源：[Tools README](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/core/tools/README.md)、[Scope README](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/core/scope/README.md)、[Permission Presets README](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/interaction/permission-presets/README.md)、[Plugin Manager README](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)。

## 一、每步解析工具集合

- 工具可通过 register 注册，也可附带 when 条件，按 agent、modelSelection、signal 进行一次步骤级判断。
- resolve 生成本次步骤持有的 ResolvedToolSet，提示词组装和后续 execute 使用同一份集合；步骤结束后释放。
- 解析后的集合不会无限期赋权：注册被撤销、限制变更或同名替换，均会阻止尚未开始的调用使用旧注册。
- Agent 级 restrict 形成可见工具的 allow/deny 过滤；作用域注册可局部覆盖同名工具，限制掩码与继承关系另行处理。
- 这为 WEX 的“同一模型服务不同岗位、不同任务能力集合”提供参考，但模型可见性不等于执行授权。

## 二、Scope 的价值与硬边界

- createScope 建立父子作用域；子作用域继承父层注册，父层不反向继承子层。
- 同一个 scoped context 同时决定贡献的可见性和生命周期；dispose 清理该作用域拥有的注册。
- Scope 是受信任同进程插件的注册机制，不是沙箱、权限或安全隔离。
- 文档明确：只有 scope-aware API 才隔离；任意普通 Cordis service 不会自动因 scoped context 而隔离。
- Scope 当前是单一最近 key 与父链，不能直接表达一个主体同时属于多个组织或控制域的复杂关系。
- 给出 scoped context 也会暴露创建者能够解析的服务，不能将其当作权限受限的能力句柄。

## 三、权限预设与真实执行机制分离

- Permission Presets 将 sandbox mode 和 approval policy 打包为用户可选择的预设。
- 预设只负责选择和默认值；真正的沙箱和审批由各自的执行服务负责。
- 新会话读取默认预设，已有会话不会因为默认值改变而被无声覆盖。
- “custom”是当前组合不匹配已配置预设时的派生展示状态，不是独立授权机制。
- 对 WEX 的启发：角色权限等级、预设名称不能代替最终资源授权与执行检查。

## 四、插件管理的安全风险

- Plugin Manager 可以启停和安装 bundle，HMR 打开时可立即应用配置。
- DSH 文档明确指出，安装的 Host 代码在进程内执行，位于 workspace sandbox 之外。
- 插件管理操作要求高权限或逐次审批，但审批安装不等于隔离安装后代码。
- 因此 WEX 必须将插件可信度、代码执行位置、安装授权、运行时授权分别设计；不能以“可热加载”推导“安全可热加载”。

## 五、WEX 需要拿真实案例验证

1. 秘书与施工 AI 使用同一 Provider/Model，但工具可见范围和执行权限不同。
2. 工具解析完成后权限被撤销，尚未开始的操作必须拒绝。
3. 插件卸载时新调用停止，已开始调用的取消、排空和回执语义明确。
4. 同一 AI 同时代表个人与公司时，不可直接将 DSH 单父链 Scope 当作多主体授权模型。
5. 低信任第三方扩展即使通过安装审批，也不能因此获得宿主所有服务。
6. 预设切换与真实资源授权、执行回执保持一致。

## 六、初步判断

DSH 的注册、作用域、条件工具解析、权限预设和执行管线值得分别借鉴；但其作用域不是多组织权限模型，插件管理也不是安全沙箱。WEX 应把“能力发现与可见性”和“真正的授权与执行边界”作为不同契约设计。
