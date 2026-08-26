---
phase: 33-bug
reviewed: 2026-08-13T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - credential-manager.js
  - main.js
  - ipc-handlers.js
  - src/preload.js
  - src/webview-preload.js
  - src/renderer.js
  - src/index.html
  - src/settings.html
  - src/settings-page.js
  - src/styles/main.css
  - address-manager.js
findings:
  critical: 0
  warning: 3
  warning_fixed: 3
  info: 2
  total: 5
status: fixed
---

# Phase 33: Code Review Report

**Reviewed:** 2026-08-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed Phase 33 implementation covering credential management UI (AF-04) and address management (AF-06, AF-07) across 11 source files. The overall implementation is solid: HTTP API endpoints all use REALM_TOKEN authentication, DOM rendering uses textContent to prevent XSS, address PII is encrypted with safeStorage, and the credential list endpoint correctly excludes passwords.

Three warnings were found: a missing key rotation handler in address-manager.js that could cause data loss, an innerHTML template that injects database IDs directly, and an ESC key handler leak in the renderer. Two informational items note an unimplemented "never save" feature for addresses and an inconsistent decryption return pattern between the two managers.

## Warnings

### WR-01: address-manager.js `getAddress` does not handle safeStorage key rotation

**File:** `address-manager.js:188-203`
**Issue:** The `getAddress` function calls `decryptField` which returns the raw result from `safeStorage.decryptStringAsync` including a `shouldReEncrypt` flag. However, unlike `credential-manager.js` (lines 206-217) which checks this flag and re-encrypts with the new key, `getAddress` ignores it entirely. When safeStorage keys rotate (e.g., macOS Keychain migration, keychain password change), address fields will not be re-encrypted with the new key. Subsequent decryption attempts with the rotated key will fail, causing address data loss.

**Fix:**
```javascript
// In getAddress(), after decryption succeeds, add key rotation handling:
const [nameResult, phoneResult, addressResult] = await Promise.all([
  decryptField(row.encrypted_name),
  decryptField(row.encrypted_phone),
  decryptField(row.encrypted_address),
]);

if (!nameResult || !phoneResult || !addressResult) {
  console.error('[Realm] 地址解密失败，返回 null');
  return null;
}

// 密钥轮转懒更新（与 credential-manager 保持一致）
if (nameResult.shouldReEncrypt || phoneResult.shouldReEncrypt || addressResult.shouldReEncrypt) {
  console.log('[Realm] 密钥已轮转，重新加密地址数据');
  const [reEncName, reEncPhone, reEncAddr] = await Promise.all([
    encryptField(nameResult.result),
    encryptField(phoneResult.result),
    encryptField(addressResult.result),
  ]);
  if (reEncName && reEncPhone && reEncAddr) {
    try {
      db.prepare(`
        UPDATE addresses SET encrypted_name = ?, encrypted_phone = ?, encrypted_address = ?, updated_at = ? WHERE id = ?
      `).run(reEncName, reEncPhone, reEncAddr, Date.now(), row.id);
    } catch (updateErr) {
      console.error('[Realm] 重新加密地址数据失败:', updateErr.message);
    }
  }
}
```

### WR-02: Credential detail row uses innerHTML with database-sourced data

**File:** `src/settings-page.js:1810-1827`
**Issue:** The credential detail row template uses `innerHTML` with `cred.id` (an autoincrement INTEGER from SQLite) injected via template literal at `${cred.id}`. While safe with the current schema (INTEGER PRIMARY KEY AUTOINCREMENT guarantees numeric values), this pattern is fragile. If the schema ever changes or if `cred.id` is unexpectedly non-numeric, it could break the HTML or create an injection vector. The codebase convention (WR-13) is to use DOM construction + textContent for user-controlled data.

**Fix:**
```javascript
// Replace innerHTML with DOM construction:
const detailRow = document.createElement('div');
detailRow.className = 'credential-detail hidden';
detailRow.id = `credential-detail-${cred.id}`;

const content = document.createElement('div');
content.className = 'credential-detail-content';

// Password field
const pwdField = document.createElement('div');
pwdField.className = 'credential-detail-field';
const pwdLabel = document.createElement('span');
pwdLabel.className = 'credential-detail-label';
pwdLabel.textContent = '密码';
const pwdValue = document.createElement('span');
pwdValue.className = 'credential-detail-value';
const maskedSpan = document.createElement('span');
maskedSpan.className = 'credential-password-masked';
maskedSpan.textContent = '••••••••';
const toggleBtn = document.createElement('button');
toggleBtn.className = 'btn btn-secondary btn-sm credential-toggle-password';
toggleBtn.dataset.id = String(cred.id);
toggleBtn.textContent = '显示';
pwdValue.appendChild(maskedSpan);
pwdValue.appendChild(toggleBtn);
pwdField.appendChild(pwdLabel);
pwdField.appendChild(pwdValue);

// Time field
const timeField = document.createElement('div');
timeField.className = 'credential-detail-field';
const timeLabel = document.createElement('span');
timeLabel.className = 'credential-detail-label';
timeLabel.textContent = '保存时间';
const timeValue = document.createElement('span');
timeValue.className = 'credential-detail-value credential-detail-time';
timeValue.textContent = new Date(cred.updated_at).toLocaleString();
timeField.appendChild(timeLabel);
timeField.appendChild(timeValue);

// Delete button
const actionsDiv = document.createElement('div');
actionsDiv.className = 'credential-detail-actions';
const detailDeleteBtn = document.createElement('button');
detailDeleteBtn.className = 'btn btn-danger btn-sm credential-detail-delete';
detailDeleteBtn.textContent = '删除此凭据';
actionsDiv.appendChild(detailDeleteBtn);

content.appendChild(pwdField);
content.appendChild(timeField);
content.appendChild(actionsDiv);
detailRow.appendChild(content);
```

### WR-03: ESC key handler leak in address save banner

**File:** `src/renderer.js:8687-8693`
**Issue:** `showSaveAddressBanner` adds a `keydown` event listener on `document` for ESC key each time the banner is shown. The listener only removes itself when ESC is actually pressed. If the banner is dismissed via button click (save/never/later) or the 10-second auto-timeout, the ESC handler remains attached. Repeated banner shows accumulate orphaned listeners on the document.

**Fix:**
```javascript
// Store the ESC handler reference so it can be cleaned up by other dismiss paths:
function showSaveAddressBanner(data) {
  const banner = elements.addressSaveBanner;
  if (!banner) return;

  // 清除之前的定时器和 ESC handler
  if (state.addressBannerTimer) {
    clearTimeout(state.addressBannerTimer);
    state.addressBannerTimer = null;
  }
  if (state.addressEscHandler) {
    document.removeEventListener('keydown', state.addressEscHandler);
    state.addressEscHandler = null;
  }

  // ... existing banner show logic ...

  // ESC 键隐藏（等同于暂不）
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      hideAddressBanner();
      document.removeEventListener('keydown', escHandler);
      state.addressEscHandler = null;
    }
  };
  state.addressEscHandler = escHandler;
  document.addEventListener('keydown', escHandler);
}

function hideAddressBanner() {
  const banner = elements.addressSaveBanner;
  if (!banner) return;

  // 清理 ESC handler
  if (state.addressEscHandler) {
    document.removeEventListener('keydown', state.addressEscHandler);
    state.addressEscHandler = null;
  }

  banner.classList.remove('visible');
  setTimeout(() => {
    banner.classList.add('hidden');
  }, 300);
}
```

## Info

### IN-01: Address "never save" button is a no-op (TODO)

**File:** `src/renderer.js:8669`
**Issue:** The "never" button on the address save banner only hides the banner without persisting the preference. The comment `// TODO: 实现地址永不保存功能` indicates this is intentionally unimplemented. Unlike credentials which have `markNeverSave`/`isNeverSave` in `credential-manager.js`, no equivalent exists for addresses. Users who click "never" will be prompted again on the next address form detection.

**Fix:** Implement a `neverSaveAddresses` container flag (similar to credential never-save) in address-manager.js, or use a simpler per-container config flag via electron-store.

### IN-02: Inconsistent decryption return pattern between managers

**File:** `address-manager.js:88-98` vs `credential-manager.js:110-121`
**Issue:** `credential-manager.js` wraps `safeStorage.decryptStringAsync` in a `decryptPassword` function that normalizes the return value to `{password: string, shouldReEncrypt: boolean}`. `address-manager.js` exposes the raw `safeStorage.decryptStringAsync` result `{result: string, shouldReEncrypt: boolean}` directly from `decryptField`. While both work correctly, the naming inconsistency (`password` vs `result`) and the missing key rotation handling in address-manager (WR-01) suggest the two modules diverged during development.

**Fix:** Consider extracting a shared decrypt utility or aligning the return shape for consistency. If WR-01 is fixed, this becomes purely a naming/style concern.

---

_Reviewed: 2026-08-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
