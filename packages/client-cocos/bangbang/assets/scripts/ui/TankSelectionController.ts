/**
 * TankSelectionController.ts — Interactive tank selection lobby UI
 */

import {
  _decorator, Component, Node, Graphics, Label, Color, UITransform, LabelOutline, Layers, BlockInputEvents, input, Input, Vec3
} from 'cc';
import { TankId } from '../shared/types/tank';
import { TANK_ROSTER } from '../shared/data/tank-roster';

const { ccclass } = _decorator;

@ccclass('TankSelectionController')
export class TankSelectionController extends Component {
  private selectedId: TankId = TankId.IronMan;
  private cards: Map<TankId, { bgGraphics: Graphics, node: Node }> = new Map();
  private confirmCallback: ((id: TankId) => void) | null = null;
  private battleButtonGraphics: Graphics | null = null;
  private bgGraphics: Graphics | null = null;

  public init(onConfirm: (id: TankId) => void): void {
    this.confirmCallback = onConfirm;

    // Set content size for hit testing bounds on root node
    const trans = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    trans.setContentSize(1280, 720);

    // Create a dedicated background blocker child node.
    // This node covers the screen and blocks inputs from reaching elements behind the overlay.
    // Since cards and buttons are siblings added after this node, they will receive events first.
    const bgBlockerNode = new Node('BgBlocker');
    bgBlockerNode.layer = Layers.Enum.UI_2D;
    const bgTrans = bgBlockerNode.addComponent(UITransform);
    bgTrans.setContentSize(1280, 720);
    this.node.addChild(bgBlockerNode);
    this.bgGraphics = bgBlockerNode.addComponent(Graphics);

    // Stop propagation of all interaction events on the blocker node
    // to prevent clicks from passing through to the game scene.
    // By not using the BlockInputEvents component, we avoid its issues
    // where it intercepts events before sibling nodes (cards/buttons) can process them.
    const blockEvents = [
      Node.EventType.TOUCH_START,
      Node.EventType.TOUCH_MOVE,
      Node.EventType.TOUCH_END,
      Node.EventType.MOUSE_DOWN,
      Node.EventType.MOUSE_MOVE,
      Node.EventType.MOUSE_UP,
    ];
    for (const evt of blockEvents) {
      bgBlockerNode.on(evt, (event: any) => {
        event.propagationStopped = true;
      });
    }

    // 1. Title Label
    const titleNode = new Node('TitleLabel');
    titleNode.layer = Layers.Enum.UI_2D;
    this.node.addChild(titleNode);
    titleNode.setPosition(0, 240, 0);

    const titleLabel = titleNode.addComponent(Label);
    titleLabel.string = 'SELECT YOUR CHAMPION';
    titleLabel.fontSize = 32;
    titleLabel.isBold = true;
    titleLabel.color = new Color(255, 215, 0, 255); // Gold

    const titleOutline = titleNode.addComponent(LabelOutline);
    titleOutline.color = new Color(0, 0, 0, 255);
    titleOutline.width = 3;

    // 2. Subtitle Label
    const subtitleNode = new Node('SubtitleLabel');
    subtitleNode.layer = Layers.Enum.UI_2D;
    this.node.addChild(subtitleNode);
    subtitleNode.setPosition(0, 200, 0);

    const subtitleLabel = subtitleNode.addComponent(Label);
    subtitleLabel.string = 'Choose a tank to enter the multiplayer arena';
    subtitleLabel.fontSize = 14;
    subtitleLabel.color = new Color(180, 190, 210, 255);

    // 3. Setup Roster Cards
    const tankIds = [TankId.IronMan, TankId.Naruto, TankId.SpiderMan, TankId.ThanhGiong];
    const xCoords = [-330, -110, 110, 330];

    for (let i = 0; i < tankIds.length; i++) {
      const id = tankIds[i];
      const tankDef = TANK_ROSTER[id];
      const x = xCoords[i];

      // Card Node
      const cardNode = new Node(`Card_${id}`);
      cardNode.layer = Layers.Enum.UI_2D;
      const trans = cardNode.addComponent(UITransform);
      trans.setContentSize(200, 320);
      cardNode.setPosition(x, 15, 0);
      this.node.addChild(cardNode);

      // Graphics for Background/Border
      const cardGraphicsNode = new Node(`${id}_Graphics`);
      cardGraphicsNode.layer = Layers.Enum.UI_2D;
      cardGraphicsNode.addComponent(UITransform).setContentSize(200, 320);
      cardNode.addChild(cardGraphicsNode);
      const bgGraphics = cardGraphicsNode.addComponent(Graphics);

      // Name Label
      const nameNode = new Node('Name');
      nameNode.layer = Layers.Enum.UI_2D;
      cardNode.addChild(nameNode);
      nameNode.setPosition(0, 125, 0);
      const nameLabel = nameNode.addComponent(Label);
      nameLabel.string = tankDef.name;
      nameLabel.fontSize = 18;
      nameLabel.isBold = true;
      nameLabel.color = new Color(255, 255, 255, 255);
      const nameOutline = nameNode.addComponent(LabelOutline);
      nameOutline.color = new Color(0, 0, 0, 255);
      nameOutline.width = 2;

      // Role Label
      const roleNode = new Node('Role');
      roleNode.layer = Layers.Enum.UI_2D;
      cardNode.addChild(roleNode);
      roleNode.setPosition(0, 100, 0);
      const roleLabel = roleNode.addComponent(Label);
      roleLabel.string = tankDef.role.toUpperCase();
      roleLabel.fontSize = 11;
      roleLabel.color = new Color(52, 152, 219, 255); // Light Blue

      // Stats Label
      const statsNode = new Node('Stats');
      statsNode.layer = Layers.Enum.UI_2D;
      cardNode.addChild(statsNode);
      statsNode.setPosition(0, 30, 0);
      const statsLabel = statsNode.addComponent(Label);
      statsLabel.string = `HP: ${tankDef.attributes.hp}\nATK: ${tankDef.attributes.atk}\nSPD: ${tankDef.attributes.speed}`;
      statsLabel.fontSize = 11;
      statsLabel.lineHeight = 15;
      statsLabel.color = new Color(220, 225, 230, 255);

      // Skills Label
      const skillsNode = new Node('Skills');
      skillsNode.layer = Layers.Enum.UI_2D;
      cardNode.addChild(skillsNode);
      skillsNode.setPosition(0, -45, 0);
      const skillsLabel = skillsNode.addComponent(Label);
      skillsLabel.string = `E: ${tankDef.skillE.name}\nULT: ${tankDef.skillSpace.name}`;
      skillsLabel.fontSize = 11;
      skillsLabel.lineHeight = 15;
      skillsLabel.color = new Color(162, 217, 206, 255);

      // Passive Label
      const passiveNode = new Node('Passive');
      passiveNode.layer = Layers.Enum.UI_2D;
      const passTrans = passiveNode.addComponent(UITransform);
      passTrans.setContentSize(180, 50);
      cardNode.addChild(passiveNode);
      passiveNode.setPosition(0, -115, 0);

      const passiveLabel = passiveNode.addComponent(Label);
      passiveLabel.string = `${tankDef.passive.name}\n${tankDef.passive.description}`;
      passiveLabel.fontSize = 9;
      passiveLabel.lineHeight = 11;
      passiveLabel.color = new Color(245, 176, 65, 255);
      passiveLabel.overflow = 3; // RESIZE_HEIGHT

      // Event listener for click/tap (registered on both node and graphics child for maximum reliability)
      const selectHandler = (event: any) => {
        this.selectTank(id);
        event.propagationStopped = true;
      };
      cardNode.on(Node.EventType.TOUCH_START, selectHandler);
      cardNode.on(Node.EventType.MOUSE_DOWN, selectHandler);
      cardGraphicsNode.on(Node.EventType.TOUCH_START, selectHandler);
      cardGraphicsNode.on(Node.EventType.MOUSE_DOWN, selectHandler);

      this.cards.set(id, { bgGraphics, node: cardNode });
    }

    // 4. Battle Button
    const battleBtnNode = new Node('BattleButton');
    battleBtnNode.layer = Layers.Enum.UI_2D;
    const btnTrans = battleBtnNode.addComponent(UITransform);
    btnTrans.setContentSize(240, 60);
    battleBtnNode.setPosition(0, -220, 0);
    this.node.addChild(battleBtnNode);

    const btnGraphicsNode = new Node('BattleBtnGraphics');
    btnGraphicsNode.layer = Layers.Enum.UI_2D;
    btnGraphicsNode.addComponent(UITransform).setContentSize(240, 60);
    battleBtnNode.addChild(btnGraphicsNode);
    this.battleButtonGraphics = btnGraphicsNode.addComponent(Graphics);

    const btnTextNode = new Node('Label');
    btnTextNode.layer = Layers.Enum.UI_2D;
    battleBtnNode.addChild(btnTextNode);
    btnTextNode.setPosition(0, 0, 0);
    const btnLabel = btnTextNode.addComponent(Label);
    btnLabel.string = 'BATTLE';
    btnLabel.fontSize = 24;
    btnLabel.isBold = true;
    btnLabel.color = new Color(255, 255, 255, 255);

    const btnOutline = btnTextNode.addComponent(LabelOutline);
    btnOutline.color = new Color(0, 0, 0, 255);
    btnOutline.width = 2;

    // Event listener for click/tap (registered on both node and graphics child for maximum reliability)
    const confirmHandler = (event: any) => {
      if (this.confirmCallback) {
        this.confirmCallback(this.selectedId);
      }
      event.propagationStopped = true;
    };
    battleBtnNode.on(Node.EventType.TOUCH_START, confirmHandler);
    battleBtnNode.on(Node.EventType.MOUSE_DOWN, confirmHandler);
    btnGraphicsNode.on(Node.EventType.TOUCH_START, confirmHandler);
    btnGraphicsNode.on(Node.EventType.MOUSE_DOWN, confirmHandler);

    // --- On-screen Debug Console for Lobby ---
    const debugNode = new Node('DebugConsole');
    debugNode.layer = Layers.Enum.UI_2D;
    this.node.addChild(debugNode);
    debugNode.setPosition(0, -320, 0); // At the very bottom
    this.debugLabel = debugNode.addComponent(Label);
    this.debugLabel.fontSize = 11;
    this.debugLabel.color = new Color(241, 196, 15, 255); // Yellow warning color
    const debugOutline = debugNode.addComponent(LabelOutline);
    debugOutline.color = new Color(0, 0, 0, 255);
    debugOutline.width = 1.5;

    this.logDebug("Lobby initialized. Click/tap anywhere to choose.");

    // Global event listeners on input singleton as a 100% reliable fallback
    input.on(Input.EventType.TOUCH_START, this.onGlobalTouch, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onGlobalTouch, this);

    this.redraw();
  }

  private debugLabel: Label | null = null;
  private debugLogs: string[] = [];

  private logDebug(msg: string): void {
    console.log(`[Lobby UI] ${msg}`);
    this.debugLogs.push(msg);
    if (this.debugLogs.length > 5) {
      this.debugLogs.shift();
    }
    if (this.debugLabel) {
      this.debugLabel.string = this.debugLogs.join('\n');
    }
  }

  private onGlobalTouch(event: any): void {
    const loc = event.getUILocation ? event.getUILocation() : event.getLocation();
    this.logDebug(`Touch at UI coord: (${loc.x.toFixed(1)}, ${loc.y.toFixed(1)})`);

    // Manually hit test roster cards
    for (const [id, card] of this.cards) {
      const trans = card.node.getComponent(UITransform);
      if (trans) {
        const localPos = new Vec3();
        trans.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0), localPos);
        const w = trans.width;
        const h = trans.height;
        const inside = Math.abs(localPos.x) <= w / 2 && Math.abs(localPos.y) <= h / 2;
        if (inside) {
          this.logDebug(`Selected card: ${id}`);
          this.selectTank(id);
          event.propagationStopped = true;
          return;
        }
      }
    }

    // Manually hit test battle button
    const battleBtn = this.node.getChildByName('BattleButton');
    if (battleBtn) {
      const trans = battleBtn.getComponent(UITransform);
      if (trans) {
        const localPos = new Vec3();
        trans.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0), localPos);
        const w = trans.width;
        const h = trans.height;
        const inside = Math.abs(localPos.x) <= w / 2 && Math.abs(localPos.y) <= h / 2;
        if (inside) {
          this.logDebug("Battle button clicked! Commencing...");
          if (this.confirmCallback) {
            this.confirmCallback(this.selectedId);
          }
          event.propagationStopped = true;
          return;
        }
      }
    }
  }

  private selectTank(id: TankId): void {
    this.selectedId = id;
    this.redraw();
  }

  onDestroy(): void {
    input.off(Input.EventType.TOUCH_START, this.onGlobalTouch, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onGlobalTouch, this);
  }

  private redraw(): void {
    // Background Overlay
    if (this.bgGraphics) {
      this.bgGraphics.clear();
      this.bgGraphics.fillColor = new Color(15, 17, 24, 245);
      this.bgGraphics.rect(-640, -360, 1280, 720);
      this.bgGraphics.fill();
    }

    // Roster Cards
    for (const [id, card] of this.cards) {
      const g = card.bgGraphics;
      const isSelected = this.selectedId === id;
      g.clear();

      // Card Fill
      g.fillColor = isSelected ? new Color(26, 36, 54, 255) : new Color(21, 23, 30, 255);
      g.rect(-100, -160, 200, 320);
      g.fill();

      // Card Border
      if (isSelected) {
        g.strokeColor = new Color(241, 196, 15, 255); // Shiny gold
        g.lineWidth = 4;
      } else {
        g.strokeColor = new Color(52, 73, 94, 255);
        g.lineWidth = 1.5;
      }
      g.rect(-100, -160, 200, 320);
      g.stroke();
    }

    // Battle Button
    if (this.battleButtonGraphics) {
      const bg = this.battleButtonGraphics;
      bg.clear();
      bg.fillColor = new Color(39, 174, 96, 255); // Green
      bg.rect(-120, -30, 240, 60);
      bg.fill();

      bg.strokeColor = new Color(255, 255, 255, 255);
      bg.lineWidth = 2.5;
      bg.rect(-120, -30, 240, 60);
      bg.stroke();
    }
  }
}
