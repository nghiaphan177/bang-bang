import {
  Node, Camera, MeshRenderer, primitives, utils, Color, Material,
  DirectionalLight, Texture2D, resources, Canvas, Label, Graphics,
  Layers, UITransform, LabelOutline,
} from 'cc';
import { InputManager } from '../input/InputManager';
import { MapController } from '../rendering/MapController';
import { ProjectileController } from '../rendering/ProjectileController';
import { TankController } from '../rendering/TankController';
import { HUDController } from '../ui/HUDController';
import { MatchOverlayController } from '../ui/MatchOverlayController';
import { MinimapController } from '../ui/MinimapController';
import { KillFeedController } from '../ui/KillFeedController';
import { TankSelectionController } from '../ui/TankSelectionController';
import { ARCTIC_COLLISION } from '../shared/data/arctic-collision';
import { loadCollisionMap } from '../shared/data/collision-map-loader';
import { TileType } from '../shared/types/environment';

export const TILE_PX = 32;

// ─── Color Palette ────────────────────────────────────────────────
const COL_HULL      = new Color(60, 140, 70, 255);    // Military green
const COL_TURRET    = new Color(45, 110, 55, 255);    // Darker green
const COL_BARREL    = new Color(80, 80, 90, 255);     // Dark steel
const COL_GROUND    = new Color(90, 95, 85, 255);     // Terrain gray-green
const COL_ENEMY_H   = new Color(180, 50, 50, 255);    // Red hull
const COL_ENEMY_T   = new Color(140, 40, 40, 255);    // Dark red turret
const COL_STEEL     = new Color(130, 140, 150, 255);   // Steel box
const COL_WOOD      = new Color(140, 100, 55, 255);    // Wood box

export interface SceneRefs {
  gameCamera: Camera;
  inputManager: InputManager;
  mapController: MapController;
  projectileController: ProjectileController;
  playerTankController: TankController;
  remoteTanksContainer: Node;
  hudController: HUDController;
  matchOverlayController: MatchOverlayController;
  minimapController: MinimapController;
  killFeedController: KillFeedController;
  tankSelectionController: TankSelectionController;
}

export class SceneBuilder {
  private matCache: Map<string, Material> = new Map();

  public build(root: Node): SceneRefs {
    // ── Game Camera ──────────────────────────────────────────────
    const camNode = new Node('MainCamera');
    root.addChild(camNode);
    camNode.setPosition(640, 800, -480);
    camNode.setRotationFromEuler(-90, 0, 0);
    const cam = camNode.addComponent(Camera);
    cam.projection = 1; // ORTHO
    cam.orthoHeight = 360;
    cam.near = 1;
    cam.far = 2000;
    cam.visibility = 0xffffffff & ~Layers.BitMask.UI_2D;

    // ── Directional Light ──────────────────────────────────────
    const lightNode = new Node('DirLight');
    root.addChild(lightNode);
    lightNode.setRotationFromEuler(-50, 30, 0);
    const dirLight = lightNode.addComponent(DirectionalLight);
    dirLight.illuminance = 80000;

    // ── Game World ─────────────────────────────────────────────
    const world = new Node('GameWorld');
    root.addChild(world);

    // ── Ground Plane ───────────────────────────────────────────
    const mapRoot = new Node('MapRoot');
    world.addChild(mapRoot);

    const ground = new Node('GroundPlane');
    mapRoot.addChild(ground);
    const groundMR = ground.addComponent(MeshRenderer);
    groundMR.mesh = utils.createMesh(primitives.box({
      width: 1, height: 0.2, length: 1,
    }));
    const mapW = 40 * TILE_PX;
    const mapH = 30 * TILE_PX;
    ground.setPosition(mapW / 2, -0.5, mapH / 2);
    ground.setScale(mapW, 1, mapH);

    this.loadMapBgTexture(groundMR);

    const boxContainer = new Node('BoxContainer');
    mapRoot.addChild(boxContainer);

    const mapCtrl = mapRoot.addComponent(MapController);
    mapCtrl.groundPlane = ground;
    mapCtrl.boxContainer = boxContainer;

    this.spawnCollisionMap(boxContainer);

    // ── Player Tank ────────────────────────────────────────────
    const playerTank = this.createTankNode('PlayerTank', COL_HULL, COL_TURRET, COL_BARREL);
    world.addChild(playerTank);
    const playerTankController = playerTank.getComponent(TankController)!;

    // ── Remote Tanks ───────────────────────────────────────────
    const remoteTanksContainer = new Node('RemoteTanks');
    world.addChild(remoteTanksContainer);

    // ── Projectiles ────────────────────────────────────────────
    const projNode = new Node('Projectiles');
    world.addChild(projNode);
    const projectileController = projNode.addComponent(ProjectileController);

    // ── Input ──────────────────────────────────────────────────
    const inputNode = new Node('InputManager');
    root.addChild(inputNode);
    const inputManager = inputNode.addComponent(InputManager);
    inputManager.gameCamera = cam;

    // ── UI Canvas ──────────────────────────────────────────────
    const uiCanvasNode = new Node('UICanvas');
    uiCanvasNode.layer = Layers.Enum.UI_2D;
    const canvasTrans = uiCanvasNode.addComponent(UITransform);
    canvasTrans.setContentSize(1280, 720);
    root.addChild(uiCanvasNode);
    const canvas = uiCanvasNode.addComponent(Canvas);

    const uiCameraNode = new Node('UICamera');
    uiCameraNode.layer = Layers.Enum.UI_2D;
    uiCanvasNode.addChild(uiCameraNode);
    const uiCamera = uiCameraNode.addComponent(Camera);
    uiCamera.projection = 1; // ORTHO
    uiCamera.priority = 1;
    uiCamera.visibility = Layers.BitMask.UI_2D;
    uiCamera.clearFlags = 2; // DEPTH_ONLY
    canvas.cameraComponent = uiCamera;

    // HUD
    const hudNode = new Node('HUD');
    hudNode.layer = Layers.Enum.UI_2D;
    hudNode.addComponent(UITransform);
    uiCanvasNode.addChild(hudNode);
    const hudController = hudNode.addComponent(HUDController);
    
    const hpBarNode = new Node('HPBar');
    hpBarNode.layer = Layers.Enum.UI_2D;
    hudNode.addChild(hpBarNode);
    hpBarNode.setPosition(-400, 300, 0);
    hudController.hpBar = hpBarNode.addComponent(Graphics);
    
    const hpLabelNode = new Node('HPLabel');
    hpLabelNode.layer = Layers.Enum.UI_2D;
    hudNode.addChild(hpLabelNode);
    hpLabelNode.setPosition(-400, 300, 0);
    hudController.hpLabel = hpLabelNode.addComponent(Label);
    
    hudController.pingLabel = this.createLabelNode('PingLabel', hudNode, 400, 300);
    hudController.modeLabel = this.createLabelNode('ModeLabel', hudNode, 400, 270);
    hudController.playerCountLabel = this.createLabelNode('PlayerCountLabel', hudNode, 400, 240);
    hudController.matchTimerLabel = this.createLabelNode('MatchTimerLabel', hudNode, 0, 300);
    hudController.scoreLabel = this.createLabelNode('ScoreLabel', hudNode, 0, 270);
    
    const waitingLabelNode = new Node('WaitingLabel');
    waitingLabelNode.layer = Layers.Enum.UI_2D;
    hudNode.addChild(waitingLabelNode);
    waitingLabelNode.setPosition(0, 0, 0);
    hudController.waitingLabel = waitingLabelNode.addComponent(Label);
    hudController.waitingLabel.string = 'Waiting for players...';
    hudController.waitingLabel.fontSize = 24;
    hudController.waitingLabel.node.active = false;

    // Skill Cooldowns
    const skillE = this.createSkillSlot(
      'SkillE',
      hudNode,
      -70,
      -280,
      60,
      60,
      'E'
    );
    hudController.skillEGraphics = skillE.graphics;
    hudController.skillELabel = skillE.label;

    const skillSpace = this.createSkillSlot(
      'SkillSpace',
      hudNode,
      70,
      -280,
      80,
      60,
      'SPACE'
    );
    hudController.skillSpaceGraphics = skillSpace.graphics;
    hudController.skillSpaceLabel = skillSpace.label;

    // MatchOverlay
    const matchOverlayNode = new Node('MatchOverlay');
    matchOverlayNode.layer = Layers.Enum.UI_2D;
    matchOverlayNode.addComponent(UITransform);
    uiCanvasNode.addChild(matchOverlayNode);
    const matchOverlayController = matchOverlayNode.addComponent(MatchOverlayController);
    
    matchOverlayController.countdownLabel = this.createLabelNode('CountdownLabel', matchOverlayNode, 0, 0);
    matchOverlayController.countdownLabel.fontSize = 72;
    matchOverlayController.countdownLabel.isBold = true;
    matchOverlayController.countdownLabel.node.active = false;
    
    const resultsPanel = new Node('ResultsPanel');
    resultsPanel.layer = Layers.Enum.UI_2D;
    resultsPanel.addComponent(UITransform);
    matchOverlayNode.addChild(resultsPanel);
    resultsPanel.setPosition(0, 0, 0);
    resultsPanel.active = false;
    matchOverlayController.resultsPanel = resultsPanel;
    
    matchOverlayController.resultsTitleLabel = this.createLabelNode('ResultsTitleLabel', resultsPanel, 0, 50);
    matchOverlayController.resultsDetailsLabel = this.createLabelNode('ResultsDetailsLabel', resultsPanel, 0, -50);

    // Minimap
    const minimapNode = new Node('MinimapContainer');
    minimapNode.layer = Layers.Enum.UI_2D;
    minimapNode.addComponent(UITransform);
    uiCanvasNode.addChild(minimapNode);
    minimapNode.setPosition(450, -250, 0);
    const minimapController = minimapNode.addComponent(MinimapController);
    
    const minimapGraphicsNode = new Node('MinimapGraphics');
    minimapGraphicsNode.layer = Layers.Enum.UI_2D;
    minimapNode.addChild(minimapGraphicsNode);
    minimapController.graphics = minimapGraphicsNode.addComponent(Graphics);

    // Kill Feed
    const killFeedNode = new Node('KillFeed');
    killFeedNode.layer = Layers.Enum.UI_2D;
    killFeedNode.addComponent(UITransform);
    uiCanvasNode.addChild(killFeedNode);
    killFeedNode.setPosition(400, 190, 0);
    const killFeedController = killFeedNode.addComponent(KillFeedController);

    // Tank Selection Overlay
    const selectOverlayNode = new Node('TankSelectionOverlay');
    selectOverlayNode.layer = Layers.Enum.UI_2D;
    const selectTrans = selectOverlayNode.addComponent(UITransform);
    selectTrans.setContentSize(1280, 720);
    uiCanvasNode.addChild(selectOverlayNode);
    const tankSelectionController = selectOverlayNode.addComponent(TankSelectionController);

    return {
      gameCamera: cam,
      inputManager,
      mapController: mapCtrl,
      projectileController,
      playerTankController,
      remoteTanksContainer,
      hudController,
      matchOverlayController,
      minimapController,
      killFeedController,
      tankSelectionController,
    };
  }

  private createLabelNode(name: string, parent: Node, x: number, y: number): Label {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    node.setPosition(x, y, 0);
    return node.addComponent(Label);
  }

  public createRemoteTankNode(name: string): Node {
    return this.createTankNode(name, COL_ENEMY_H, COL_ENEMY_T, COL_BARREL);
  }

  private createTankNode(
    name: string,
    hullColor: Color,
    turretColor: Color,
    barrelColor: Color,
  ): Node {
    const tankRoot = new Node(name);

    // ── Hull body ──────────────────────────────────────────────
    const hull = new Node('HullMesh');
    tankRoot.addChild(hull);
    const hullMR = hull.addComponent(MeshRenderer);
    hullMR.mesh = utils.createMesh(primitives.box({
      width: 28, height: 10, length: 36,
    }));
    hullMR.material = this.makeMat(hullColor, `hull_${name}`);
    hull.setPosition(0, 5, 0);

    const slope = new Node('HullSlope');
    hull.addChild(slope);
    const slopeMR = slope.addComponent(MeshRenderer);
    slopeMR.mesh = utils.createMesh(primitives.box({
      width: 24, height: 6, length: 8,
    }));
    slopeMR.material = this.makeMat(hullColor, `hull_${name}`);
    slope.setPosition(0, 3, -18);

    const trackMat = this.makeMat(new Color(40, 40, 45, 255), 'track');
    for (const side of [-1, 1]) {
      const track = new Node(`Track_${side > 0 ? 'R' : 'L'}`);
      hull.addChild(track);
      const trackMR = track.addComponent(MeshRenderer);
      trackMR.mesh = utils.createMesh(primitives.box({
        width: 6, height: 8, length: 40,
      }));
      trackMR.material = trackMat;
      track.setPosition(side * 16, -2, 0);
    }

    const turretPivot = new Node('TurretPivot');
    tankRoot.addChild(turretPivot);
    turretPivot.setPosition(0, 12, 0);

    const turretDome = new Node('TurretDome');
    turretPivot.addChild(turretDome);
    const domeMR = turretDome.addComponent(MeshRenderer);
    domeMR.mesh = utils.createMesh(primitives.cylinder(12, 12, 7, {
      radialSegments: 16,
    }));
    domeMR.material = this.makeMat(turretColor, `turretDome_${name}`);

    const barrel = new Node('TurretBarrel');
    turretPivot.addChild(barrel);
    const barrelMR = barrel.addComponent(MeshRenderer);
    barrelMR.mesh = utils.createMesh(primitives.cylinder(2.5, 2.5, 30, {
      radialSegments: 8,
    }));
    barrelMR.material = this.makeMat(barrelColor, `barrel_${name}`);
    barrel.setPosition(0, 0, -22);
    barrel.setRotationFromEuler(90, 0, 0);

    const ctrl = tankRoot.addComponent(TankController);
    ctrl.hullNode = hull;
    ctrl.turretPivot = turretPivot;

    return tankRoot;
  }

  private spawnCollisionMap(container: Node): void {
    const gameMap = loadCollisionMap(ARCTIC_COLLISION);
    const boxMesh = utils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
    const steelMat = this.makeMat(COL_STEEL, 'steel');
    const woodMat = this.makeMat(COL_WOOD, 'wood');

    for (let r = 0; r < gameMap.heightGrids; r++) {
      const row = gameMap.tiles[r];
      if (!row) continue;
      for (let c = 0; c < gameMap.widthGrids; c++) {
        const tile = row[c];
        if (!tile) continue;

        const wx = c * TILE_PX + TILE_PX / 2;
        const wz = r * TILE_PX + TILE_PX / 2;

        if (tile.type === TileType.SteelBox) {
          const box = new Node(`SB_${c}_${r}`);
          container.addChild(box);
          const mr = box.addComponent(MeshRenderer);
          mr.mesh = boxMesh;
          mr.material = steelMat;
          box.setPosition(wx, TILE_PX / 2, wz);
          box.setScale(TILE_PX - 2, TILE_PX - 2, TILE_PX - 2);
        } else if (tile.type === TileType.WoodBox) {
          const box = new Node(`WB_${c}_${r}`);
          container.addChild(box);
          const mr = box.addComponent(MeshRenderer);
          mr.mesh = boxMesh;
          mr.material = woodMat;
          box.setPosition(wx, TILE_PX / 2, wz);
          box.setScale(TILE_PX - 2, TILE_PX - 4, TILE_PX - 2);
        }
      }
    }
    console.log(`[Game] Map loaded: ${gameMap.name} (${gameMap.widthGrids}x${gameMap.heightGrids})`);
  }

  private loadMapBgTexture(groundMR: MeshRenderer): void {
    groundMR.material = this.makeMat(COL_GROUND, 'ground');

    resources.load('maps/arctic/map_bg', Texture2D, (err, tex) => {
      if (err) {
        resources.load('maps/arctic/map_bg/texture', Texture2D, (err2, tex2) => {
          if (err2) {
            console.warn('[Game] map_bg texture not found:', err.message);
            return;
          }
          this.applyMapTexture(groundMR, tex2);
        });
        return;
      }
      this.applyMapTexture(groundMR, tex);
    });
  }

  private applyMapTexture(groundMR: MeshRenderer, tex: Texture2D): void {
    const mat = new Material();
    mat.initialize({ effectName: 'builtin-unlit' });
    mat.setProperty('mainTexture', tex);
    mat.setProperty('mainColor', new Color(255, 255, 255, 255));
    groundMR.material = mat;
    console.log('[Game] Map background texture applied ✓');
  }

  private makeMat(color: Color, name: string): Material {
    let mat = this.matCache.get(name);
    if (mat) return mat;

    mat = new Material();
    mat.initialize({ effectName: 'builtin-unlit' });
    mat.setProperty('mainColor', color);
    this.matCache.set(name, mat);
    return mat;
  }

  private createSkillSlot(
    name: string,
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    defaultText: string
  ): { graphics: Graphics, label: Label } {
    const slotNode = new Node(name);
    slotNode.layer = Layers.Enum.UI_2D;
    const slotTrans = slotNode.addComponent(UITransform);
    slotTrans.setContentSize(width, height);
    slotNode.setPosition(x, y, 0);
    parent.addChild(slotNode);

    const graphicsNode = new Node(`${name}Graphics`);
    graphicsNode.layer = Layers.Enum.UI_2D;
    const graphicsTrans = graphicsNode.addComponent(UITransform);
    graphicsTrans.setContentSize(width, height);
    slotNode.addChild(graphicsNode);
    const graphics = graphicsNode.addComponent(Graphics);

    const labelNode = new Node(`${name}Label`);
    labelNode.layer = Layers.Enum.UI_2D;
    const labelTrans = labelNode.addComponent(UITransform);
    labelTrans.setContentSize(width, height);
    slotNode.addChild(labelNode);
    labelNode.setPosition(0, 0, 0);

    const label = labelNode.addComponent(Label);
    label.string = defaultText;
    label.fontSize = 16;
    label.color = new Color(255, 255, 255, 255);

    const outline = labelNode.addComponent(LabelOutline);
    outline.color = new Color(0, 0, 0, 255);
    outline.width = 2;

    return { graphics, label };
  }
}
