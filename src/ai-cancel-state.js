/**
 * Realm Browser - 「用户已取消」事件的归属判定纯逻辑模型（双模式导出）
 *
 * **为什么抽出独立模块**：`src/renderer.js` 是浏览器脚本、无 `module.exports`，
 * 「迟到的取消事件该落到哪条消息、要不要复位轮次状态」这条时序判定留在里面只能靠
 * 人工验证或 Playwright 驱动（构造 abort × 新消息的真实竞态成本极高）。抽到这里后
 * `node --test tests/test-ai-cancel-state.js` 可用 UAT test 4 的实测序列直接表驱动
 * 覆盖该时序。与 `src/skill-picker-model.js` 同款理由与同款双模式导出。
 *
 * **双模式导出**：`<script src="ai-cancel-state.js">` 暴露 `window.AICancelState`；
 * 纯 Node 测试 `require('src/ai-cancel-state.js')` 取**同一个 api 对象引用**。
 *
 * **依赖纪律**：本文件**零 import / 零 require / 零 DOM**（不依赖 electron / SDK），
 * 因此两个宿主都无需任何桩即可加载。
 */
(function () {
  'use strict';

  /**
   * 解算一次「用户已取消」事件的归属
   *
   * **锚点语义**：`cancelledId` 是**被取消的那条消息**的 id ——
   * `abortAIIfStreaming()` / `handleStopAI()` 在置 `state.aiCancelledByUser` 的同一处
   * 记录它（`state.aiCancelledMessageId`）；`currentId` 是**当前**轮次的消息 id
   * （`state.aiCurrentMessageId`）。
   *
   * **为什么不能用 `currentId` 做归属**：`ai:abort` 处理器同步返回（`ipc-handlers.js`
   * 只调 `aiManager.abort()` 后立即 return），renderer 的 `await` 先恢复、同步段已把
   * `aiCurrentMessageId` 指向**新气泡**；被中止那一轮的迟到 `error` 到达时若按
   * 「当前消息 id」记账，新气泡会被写成「用户已取消」，且 `aiCurrentMessageId` 被置
   * null，使新轮的 `message_update` / `tool_execution_update`（都按
   * `state.aiCurrentMessageId` 查找）**整批丢弃**。这正是 UAT test 4 的实测序列：
   * 新气泡在 t≈7.4s 被写成取消文案，此后 15s 零增长、停止按钮提前回退。
   *
   * **`resetRunState` 的边界**：只由锚点等式 `cancelledId === currentId` 决定，
   * **与 `messages` 的形态无关** —— 消息已被移除、列表为空都不改变该式。这恰是
   * 「用户点停止」既有语义不丢的原因：那一刻锚点就是当前轮，气泡仍被标为已取消、
   * 按钮仍切回发送。反过来，新一轮已开始（`currentId !== cancelledId`）时**不得**
   * 复位，否则新轮整批事件被丢（本函数存在的全部理由）。
   *
   * @param {Array<{role?: string, id?: string}>} messages - 当前消息列表（非数组按空列表处理）
   * @param {string|null|undefined} cancelledId - 被取消消息的锚点
   * @param {string|null|undefined} currentId - 当前轮次的消息 id
   * @returns {{targetIndex: number, resetRunState: boolean}} 目标索引（-1 = 未命中）与是否复位轮次状态
   */
  function resolveCancelAttribution(messages, cancelledId, currentId) {
    // 入参守卫：本函数在 renderer 的高频事件回调里**同步**执行，不得抛错 ——
    // 非数组入参（null / undefined / 字符串 / 对象）一律按空列表处理
    const list = Array.isArray(messages) ? messages : [];

    const targetIndex = cancelledId
      ? list.findIndex((m) => !!m && m.role === 'assistant' && m.id === cancelledId)
      : -1;

    return {
      targetIndex,
      // **只由锚点等式决定**，不看消息列表形态（见上方 JSDoc 的边界说明）
      resetRunState: !!cancelledId && cancelledId === currentId,
    };
  }

  const api = {
    resolveCancelAttribution,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AICancelState = api;
})();
