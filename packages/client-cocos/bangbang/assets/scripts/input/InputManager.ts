/**
 * InputManager.ts — WASD + Mouse input for Cocos Creator 3.8
 */

import {
  _decorator, Component, input, Input, EventKeyboard,
  EventMouse, KeyCode, Camera, geometry,
} from 'cc';

const { ccclass, property } = _decorator;

export interface LocalInput {
  moveDir: { x: number; y: number } | null;
  aimAngle: number;
  fire: boolean;
  skillE: boolean;
  skillSpace: boolean;
}

@ccclass('InputManager')
export class InputManager extends Component {
  @property(Camera)
  gameCamera: Camera | null = null;

  private keys: Set<number> = new Set();
  private fireHeld = false;
  private skillEPressed = false;
  private skillSpacePressed = false;

  private mouseWorldX = 0;
  private mouseWorldZ = 0;

  private tankWorldX = 0;
  private tankWorldZ = 0;

  onLoad(): void {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
  }

  setTankPosition(x: number, z: number): void {
    this.tankWorldX = x;
    this.tankWorldZ = z;
  }

  getInput(): LocalInput {
    let mx = 0;
    let my = 0;
    // Standard 2D: -y is UP (W), +y is DOWN (S)
    if (this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) my -= 1;
    if (this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN)) my += 1;
    if (this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT)) mx -= 1;
    if (this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) mx += 1;

    const moveDir = (mx !== 0 || my !== 0) ? { x: mx, y: my } : null;

    const dx = this.mouseWorldX - this.tankWorldX;
    const dz = this.mouseWorldZ - this.tankWorldZ;
    // dz matches dy (since Z maps directly to Y)
    const aimAngle = Math.atan2(dz, dx);

    const skillE = this.skillEPressed;
    const skillSpace = this.skillSpacePressed;
    this.skillEPressed = false;
    this.skillSpacePressed = false;

    return { moveDir, aimAngle, fire: this.fireHeld, skillE, skillSpace };
  }

  private onKeyDown(event: EventKeyboard): void {
    this.keys.add(event.keyCode);
    if (event.keyCode === KeyCode.KEY_E) this.skillEPressed = true;
    if (event.keyCode === KeyCode.SPACE) this.skillSpacePressed = true;
  }

  private onKeyUp(event: EventKeyboard): void {
    this.keys.delete(event.keyCode);
  }

  private onMouseDown(event: EventMouse): void {
    if (event.getButton() === EventMouse.BUTTON_LEFT) this.fireHeld = true;
  }

  private onMouseUp(event: EventMouse): void {
    if (event.getButton() === EventMouse.BUTTON_LEFT) this.fireHeld = false;
  }

  private onMouseMove(event: EventMouse): void {
    if (!this.gameCamera) return;

    const sx = event.getLocationX();
    const sy = event.getLocationY();

    const ray = new geometry.Ray();
    this.gameCamera.screenPointToRay(sx, sy, ray);

    // Intersect with Y=0 ground plane
    if (Math.abs(ray.d.y) > 0.0001) {
      const t = -ray.o.y / ray.d.y;
      if (t > 0) {
        this.mouseWorldX = ray.o.x + t * ray.d.x;
        this.mouseWorldZ = ray.o.z + t * ray.d.z;
      }
    }
  }
}
