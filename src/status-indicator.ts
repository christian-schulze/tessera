import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import Gio from "gi://Gio";
import St from "gi://St";

type TesseraStatusIndicatorDeps = {
  iconPath: string;
  onReloadConfig: () => void;
};

export class TesseraStatusIndicator {
  private readonly button: PanelMenu.Button;

  constructor({ iconPath, onReloadConfig }: TesseraStatusIndicatorDeps) {
    this.button = new PanelMenu.Button(0.5, "Tessera");

    const iconFile = Gio.File.new_for_path(iconPath);
    const icon = iconFile.query_exists(null)
      ? new St.Icon({
          gicon: new Gio.FileIcon({ file: iconFile }),
          style_class: "system-status-icon",
        })
      : new St.Icon({
          icon_name: "view-grid-symbolic",
          style_class: "system-status-icon",
        });

    this.button.add_child(icon);

    const reloadConfig = new PopupMenu.PopupMenuItem("Reload config");
    reloadConfig.connect("activate", () => {
      onReloadConfig();
    });
    const menu = this.button.menu as unknown as {
      addMenuItem: (item: PopupMenu.PopupMenuItem) => void;
    };
    menu.addMenuItem(reloadConfig);
  }

  addToPanel(): void {
    Main.panel.addToStatusArea("tessera", this.button);
  }

  destroy(): void {
    this.button.destroy();
  }
}
