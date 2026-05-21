/**
 * ProjectileController.ts — Projectile rendering with simple pooling
 */

import { _decorator, Component, Node, Quat, MeshRenderer, primitives, utils, Material, Color, Vec3, tween } from 'cc';

const { ccclass, property } = _decorator;

const TILE_PX = 32;
const _tempQuat = new Quat();

export interface RenderableProjectile {
  id: string;
  transform: { position: { x: number; y: number }; rotation: number };
  projectile: { phase: string };
}

@ccclass('ProjectileController')
export class ProjectileController extends Component {
  private pool: Node[] = [];
  private activeProjectiles: Map<string, Node> = new Map();
  private projMesh: any = null;
  private projMat: Material | null = null;
  private expMesh: any = null;
  private expMat: Material | null = null;

  onLoad(): void {
    this.projMesh = utils.createMesh(primitives.box({ width: 6, height: 4, length: 12 }));
    this.projMat = new Material();
    this.projMat.initialize({ effectName: 'builtin-unlit' });
    this.projMat.setProperty('mainColor', new Color(255, 200, 50, 255));

    this.expMesh = utils.createMesh(primitives.sphere(1.5));
    this.expMat = new Material();
    this.expMat.initialize({ effectName: 'builtin-unlit' });
    this.expMat.setProperty('mainColor', new Color(255, 100, 0, 255));
  }

  updateProjectiles(projectiles: RenderableProjectile[]): void {
    const activeIds = new Set<string>();

    for (const proj of projectiles) {
      activeIds.add(proj.id);
      let node = this.activeProjectiles.get(proj.id);

      if (!node) {
        node = this.pool.pop() ?? this.createProjectileNode();
        node.active = true;
        this.node.addChild(node);
        this.activeProjectiles.set(proj.id, node);
      }

      const wx = proj.transform.position.x * TILE_PX;
      const wz = proj.transform.position.y * TILE_PX;

      node.setPosition(wx, 0.5, wz);

      // Rotation
      const deg = -(proj.transform.rotation * (180 / Math.PI)) - 90;
      Quat.fromEuler(_tempQuat, 0, deg, 0);
      node.setRotation(_tempQuat);

      node.active = proj.projectile.phase === 'Active';
    }

    for (const [id, node] of this.activeProjectiles) {
      if (!activeIds.has(id)) {
        const lastPos = node.getPosition();
        this.spawnExplosion(lastPos);

        node.removeFromParent();
        node.active = false;
        this.pool.push(node);
        this.activeProjectiles.delete(id);
      }
    }
  }

  private spawnExplosion(pos: Vec3): void {
    const expNode = new Node('Explosion');
    const mr = expNode.addComponent(MeshRenderer);
    mr.mesh = this.expMesh;
    if (this.expMat) {
      mr.material = this.expMat;
    }
    expNode.setPosition(pos.x, 0.5, pos.z);
    expNode.setScale(0, 0, 0);
    this.node.addChild(expNode);

    tween(expNode)
      .to(0.12, { scale: new Vec3(1.8, 1.8, 1.8) })
      .to(0.08, { scale: new Vec3(0, 0, 0) })
      .call(() => {
        expNode.destroy();
      })
      .start();
  }

  private createProjectileNode(): Node {
    const node = new Node('Projectile');
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = this.projMesh;
    if (this.projMat) {
      mr.material = this.projMat;
    }
    return node;
  }
}
