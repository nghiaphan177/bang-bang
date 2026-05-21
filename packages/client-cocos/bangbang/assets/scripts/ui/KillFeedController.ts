/**
 * KillFeedController.ts — Dynamic, animated kill notification feed
 */

import {
  _decorator, Component, Node, Label, Color, tween, Vec3,
  UITransform, Layers, UIOpacity, LabelOutline,
} from 'cc';

const { ccclass } = _decorator;

@ccclass('KillFeedController')
export class KillFeedController extends Component {
  private entries: Node[] = [];

  addKillEntry(killerName: string, victimName: string): void {
    // 1. Create parent container node for vertical positioning (Y offset)
    const yContainer = new Node('KillEntryY');
    yContainer.layer = Layers.Enum.UI_2D;
    const yTransform = yContainer.addComponent(UITransform);
    yTransform.anchorX = 1;
    yTransform.anchorY = 0.5;

    // 2. Create child container node for horizontal slide-in (X offset)
    const xContainer = new Node('KillEntryX');
    xContainer.layer = Layers.Enum.UI_2D;
    const xTransform = xContainer.addComponent(UITransform);
    xTransform.anchorX = 1;
    xTransform.anchorY = 0.5;
    yContainer.addChild(xContainer);

    // 3. Add Label to child container
    const label = xContainer.addComponent(Label);
    label.string = `🔫 ${killerName} → ${victimName}`;
    label.fontSize = 18;
    label.color = new Color(255, 255, 255, 255);

    // 4. Add LabelOutline to make text pop on top of 3D environment
    const outline = xContainer.addComponent(LabelOutline);
    outline.color = new Color(20, 20, 20, 255);
    outline.width = 2;

    // 5. Add UIOpacity for fade animation
    const uiOpacity = xContainer.addComponent(UIOpacity);
    uiOpacity.opacity = 255;

    // Add to main component node
    this.node.addChild(yContainer);
    this.entries.push(yContainer);

    // Calculate Y offset and set initial positions
    const targetY = (this.entries.length - 1) * -40;
    yContainer.setPosition(new Vec3(0, targetY, 0));
    xContainer.setPosition(new Vec3(350, 0, 0)); // Start off-screen (right)

    // Slide in from right
    tween(xContainer)
      .to(0.3, { position: new Vec3(0, 0, 0) }, { easing: 'sineOut' })
      .delay(4.0) // Hold for 4 seconds
      .call(() => {
        // Fade out
        tween(uiOpacity)
          .to(0.5, { opacity: 0 })
          .call(() => {
            this.removeEntry(yContainer);
          })
          .start();
      })
      .start();

    // Enforce max 5 entries
    if (this.entries.length > 5) {
      const oldest = this.entries.shift();
      if (oldest) {
        const xc = oldest.getChildByName('KillEntryX');
        if (xc) {
          tween(xc).stop();
          const op = xc.getComponent(UIOpacity);
          if (op) {
            tween(op).stop();
            // Fast fade out and destroy oldest entry
            tween(op)
              .to(0.15, { opacity: 0 })
              .call(() => {
                if (oldest.isValid) {
                  oldest.destroy();
                }
              })
              .start();
          } else {
            if (oldest.isValid) oldest.destroy();
          }
        } else {
          if (oldest.isValid) oldest.destroy();
        }
      }
    }

    // Move all current entries to their correct target Y positions
    this.repositionEntries();
  }

  private removeEntry(yContainer: Node): void {
    const index = this.entries.indexOf(yContainer);
    if (index !== -1) {
      this.entries.splice(index, 1);
      this.repositionEntries();
    }
    if (yContainer.isValid) {
      yContainer.destroy();
    }
  }

  private repositionEntries(): void {
    for (let i = 0; i < this.entries.length; i++) {
      const entryNode = this.entries[i];
      if (entryNode.isValid) {
        const targetY = i * -40;
        tween(entryNode)
          .to(0.2, { position: new Vec3(0, targetY, 0) }, { easing: 'sineOut' })
          .start();
      }
    }
  }
}
