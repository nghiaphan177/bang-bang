/**
 * ProjectileController.ts — Projectile rendering with simple pooling
 */

import { _decorator, Component, Node, Quat, MeshRenderer, primitives, utils, Material, Color } from 'cc';

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

  onLoad(): void {
    this.projMesh = utils.createMesh(primitives.box({ width: 6, height: 4, length: 12 }));
    this.projMat = new Material();
    this.projMat.initialize({ effectName: 'builtin-unlit' });
    this.projMat.setProperty('mainColor', new Color(255, 200, 50, 255));
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
        node.removeFromParent();
        node.active = false;
        this.pool.push(node);
        this.activeProjectiles.delete(id);
      }
    }
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
