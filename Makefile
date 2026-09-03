.PHONY: publish install install-nightly dev start clean

APP_NAME := Realm
APP_NAME_NIGHTLY := Realm Nightly
DIST_DIR := dist
APP_PATH := $(DIST_DIR)/mac-arm64/$(APP_NAME).app
INSTALL_DIR := /Applications

# 打包 DMG 安装包
publish:
	npm run build:mac

# 只打包 .app 并复制到 /Applications
install:
	npx electron-builder --mac dir
	rm -rf "$(INSTALL_DIR)/$(APP_NAME).app"
	cp -R "$(APP_PATH)" "$(INSTALL_DIR)/$(APP_NAME).app"
	@echo "已安装到 $(INSTALL_DIR)/$(APP_NAME).app"

# 安装 Nightly 版 .app 到 /Applications
install-nightly:
	@cp main.js main.js.bak
	@trap 'mv main.js.bak main.js' EXIT; \
	SED_CMD="s/^const crypto = require('crypto');\$$/&\\nprocess.env.NODE_ENV = 'nightly';/" && \
	sed -i '' "$$SED_CMD" main.js; \
	echo "构建 $(APP_NAME_NIGHTLY).app ..."; \
	npx electron-builder --mac dir --config.productName="$(APP_NAME_NIGHTLY)" --config.appId=com.realm.browser.nightly --config.mac.icon=icons/icon-nightly.icns
	rm -rf "$(INSTALL_DIR)/$(APP_NAME_NIGHTLY).app"
	cp -R "$(DIST_DIR)/mac-arm64/$(APP_NAME_NIGHTLY).app" "$(INSTALL_DIR)/$(APP_NAME_NIGHTLY).app"
	@echo "已安装 Nightly 版到 $(INSTALL_DIR)/$(APP_NAME_NIGHTLY).app"

dev:
	npm run dev

start:
	npm start

clean:
	rm -rf $(DIST_DIR)
