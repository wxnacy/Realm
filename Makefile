.PHONY: publish install install-test dev start clean

APP_NAME := Realm
APP_NAME_TEST := Realm-Test
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

# 安装测试版 .app 到 /Applications
install-test:
	@cp main.js main.js.bak
	@trap 'mv main.js.bak main.js' EXIT; \
	SED_CMD="s/^const crypto = require('crypto');\$$/&\\nprocess.env.NODE_ENV = 'test';/" && \
	sed -i '' "$$SED_CMD" main.js; \
	echo "构建 $(APP_NAME_TEST).app ..."; \
	npx electron-builder --mac dir --config.productName=$(APP_NAME_TEST) --config.appId=com.realm.browser.test
	rm -rf "$(INSTALL_DIR)/$(APP_NAME_TEST).app"
	cp -R "$(DIST_DIR)/mac-arm64/$(APP_NAME_TEST).app" "$(INSTALL_DIR)/$(APP_NAME_TEST).app"
	@echo "已安装测试版到 $(INSTALL_DIR)/$(APP_NAME_TEST).app"

dev:
	npm run dev

start:
	npm start

clean:
	rm -rf $(DIST_DIR)
