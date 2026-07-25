.PHONY: publish install dev start clean

APP_NAME := Realm
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

dev:
	npm run dev

start:
	npm start

clean:
	rm -rf $(DIST_DIR)
