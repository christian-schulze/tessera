UUID = tessera@tessera.dev
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
REPO_DIR = $(CURDIR)
BUILD_DIR = $(CURDIR)/dist

.PHONY: help build install uninstall enable disable restart nested looking-glass lint test check logs logs-nested clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Compile TypeScript to JavaScript
	bunx tsc
	cp metadata.json $(BUILD_DIR)/
	@echo "Build complete: $(BUILD_DIR)/"

install: build ## Symlink build output into GNOME Shell extensions directory
	@if [ -L "$(INSTALL_DIR)" ]; then \
		echo "Symlink already exists: $(INSTALL_DIR)"; \
	elif [ -e "$(INSTALL_DIR)" ]; then \
		echo "Error: $(INSTALL_DIR) exists and is not a symlink"; exit 1; \
	else \
		ln -s "$(BUILD_DIR)" "$(INSTALL_DIR)"; \
		echo "Installed: $(INSTALL_DIR) -> $(BUILD_DIR)"; \
	fi

uninstall: ## Remove symlink from GNOME Shell extensions directory
	@if [ -L "$(INSTALL_DIR)" ]; then \
		rm "$(INSTALL_DIR)"; \
		echo "Removed symlink: $(INSTALL_DIR)"; \
	elif [ -e "$(INSTALL_DIR)" ]; then \
		echo "Error: $(INSTALL_DIR) is not a symlink, refusing to remove"; exit 1; \
	else \
		echo "Nothing to remove: $(INSTALL_DIR) does not exist"; \
	fi

enable: ## Enable the extension
	gnome-extensions enable $(UUID)

disable: ## Disable the extension
	gnome-extensions disable $(UUID)

restart: build ## Rebuild and re-enable the extension
	gnome-extensions disable $(UUID) && gnome-extensions enable $(UUID)

nested: ## Launch a nested GNOME Shell session
	@mkdir -p "$(HOME)/.local/state/tessera"
	dbus-run-session -- bash -lc 'echo "$$DBUS_SESSION_BUS_ADDRESS" > .nested-bus; TESSERA_IPC=$${TESSERA_IPC:-1} gnome-shell --devkit --wayland 2>&1 | tee -a "$(HOME)/.local/state/tessera/nested-gnome-shell.log"'

looking-glass: ## Open Looking Glass in current GNOME Shell session
	@if [ -f .nested-bus ]; then \
		DBUS_SESSION_BUS_ADDRESS=$$(cat .nested-bus) gdbus call --session \
			--dest org.gnome.Shell \
			--object-path /org/gnome/Shell \
			--method org.gnome.Shell.Eval \
			"imports.ui.main.openLookingGlass();"; \
	else \
		gdbus call --session \
			--dest org.gnome.Shell \
			--object-path /org/gnome/Shell \
			--method org.gnome.Shell.Eval \
			"imports.ui.main.openLookingGlass();"; \
	fi

logs: ## Tail Tessera logs
	@mkdir -p "$(HOME)/.local/state/tessera" && touch "$(HOME)/.local/state/tessera/tessera.log"
	@tail -f "$(HOME)/.local/state/tessera/tessera.log"

logs-nested: ## Tail nested GNOME Shell logs
	@mkdir -p "$(HOME)/.local/state/tessera" && touch "$(HOME)/.local/state/tessera/nested-gnome-shell.log"
	@tail -f "$(HOME)/.local/state/tessera/nested-gnome-shell.log"

lint: ## Run ESLint on source files
	bunx eslint src/

test: ## Run unit tests
	bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json

check: lint build test ## Run all checks (lint, build, tests)
	@echo "All checks passed"

clean: ## Remove build output
	rm -rf $(BUILD_DIR)
