# MASTER GAME DESIGN DOCUMENT (GDD)
## PROJECT: BANG BANG CMM (REMAKE)

**Genre:** 2D Top-down Casual Arena Tank Shooter / Bullet-Hell.
**Target Tech Stack:** 
- **Client/UI/Rendering:** Cocos Creator 3.8 LTS (3D mode, orthographic camera, cel-shaded)
- **3D Modeling:** Blender 4.x → `.glb` export
- **Networking:** WebSockets (Server-Authoritative, Client Prediction)
- **Logic & Data Models:** TypeScript (Strict Typing)

**Core Design Philosophy:**
Fast-paced, arena-based combat. **NO Energy/Mana system** — combat rhythm is dictated purely by precise Cooldown Management and Attack Speed. NO ammo/reload — attacks are infinite, gated by attackSpeed. NO traditional MOBA mechanics (no minion wave farming for gold, no in-match item shops). Progression relies on In-Match Tank Evolution (5 Levels = 5 Visual Tiers) and Out-Match Garage Upgrades.

> 🤖 **For AI Agents:** Read `docs/AGENT_CONTEXT.md` first for a structured overview of the architecture, current state, and all rules.

---

## 1. CƠ CHẾ ĐIỀU KHIỂN & VẬT LÝ LÕI (CORE CONTROLS & PHYSICS)

Sử dụng **Arcade Physics** (Hitbox Hình tròn và Hình chữ nhật) thay vì vật lý RigidBody (khối lượng, gia tốc) để đảm bảo đồng bộ mạng chính xác qua WebSockets.

### 1.1. Hệ thống Điều khiển Kép (Twin-Stick System)
Mỗi Tank Entity được cấu thành từ 2 bộ phận đồ họa (Sprite) và góc xoay (Rotation) hoàn toàn độc lập, dùng chung 1 hệ tọa độ (Position):
*   **Thân xe (Hull):**
    *   **Input:** WASD (Di chuyển 8 hướng).
    *   **Vector Normalization Rule:** Khi nhận Input đi chéo (VD: W + D), Client và Server BẮT BUỘC phải chuẩn hóa (Normalize) vector hướng về độ dài `1` trước khi nhân với `Move_Speed`. Nếu không xử lý, vận tốc đi chéo sẽ nhanh gấp 1.414 lần đi thẳng.
    *   **Hull Rotation:** Thân xe không xoay ngay lập tức (Snap). Sử dụng thuật toán nội suy góc (Angular Lerp/Slerp) để thân xe xoay mượt mà về hướng vector đang di chuyển dựa trên chỉ số `Hull_Turn_Rate`.
*   **Nòng súng (Turret):**
    *   **Input:** Tọa độ trỏ chuột (Mouse Pointer) quy đổi sang World Coordinates.
    *   **Turret Angle:** Liên tục trỏ về hướng chuột dựa trên công thức: `Math.atan2(Mouse.Y - Tank.Y, Mouse.X - Tank.X)`.
    *   **Kiting Logic:** Sự độc lập này cho phép người chơi chạy lùi (Thân xe hướng về phía sau) trong khi nòng súng vẫn ngắm bắn về phía trước.

### 1.2. Hệ thống Va chạm & Trượt tường (Collision & Wall-Sliding)
*   **Tank Hitbox:** Hình Tròn (Circle Collider). Bán kính `Hitbox_Radius` thay đổi khi xe Tiến hóa. Hình tròn giúp xe trượt mượt mà qua các góc vuông của tường mà không bị kẹt.
*   **Wall/Obstacle Hitbox:** Hình Chữ Nhật (AABB) theo Tilemap Grid.
*   **Wall-Sliding Rule:** Khi Vector vận tốc của Tank đâm chéo vào tường, Server KHÔNG ĐƯỢC set Vận tốc = 0. Thuật toán phải chiếu Vector vận tốc lên pháp tuyến (Normal) của tường, triệt tiêu vector vuông góc và giữ lại vector song song. Tank sẽ "trượt" dọc theo bức tường.
*   **Body Blocking:** Tank là khối đặc (Solid). Đồng minh và kẻ địch không thể đi xuyên qua nhau.

### 1.3. Hệ thống Tầm nhìn & Tàng hình (Vision & Stealth System)
Sử dụng Server-side Culling. Địch ngoài tầm nhìn sẽ không được Server gửi dữ liệu qua WebSocket.
*   **Base Vision:** Mỗi Tank có bán kính `Vision_Radius`. Chia sẻ tầm nhìn với đồng minh (Shared Vision).
*   **Bụi cỏ (Bush Logic):**
    *   *Stealth Rule:* Khi tọa độ Tâm của Tank nằm hoàn toàn trong AABB của Bụi cỏ -> Kích hoạt State `Is_Stealth = true`. Tank trở nên vô hình với địch đứng ngoài cỏ.
    *   *Shared Bush Rule:* Nếu địch bước vào CÙNG MỘT bụi cỏ với Tank phe ta -> Tàng hình bị vô hiệu hóa cục bộ, cả 2 nhìn thấy nhau.
    *   *Reveal Rule:* Nếu Tank đang tàng hình mà khai hỏa (Đánh thường / Kỹ năng) -> Lập tức mất tàng hình, kích hoạt đếm ngược `Reveal_Timer = 2.5 giây`. Trong 2.5s này, mọi kẻ địch đều thấy Tank. Hết thời gian mà không tấn công thêm, tự động tàng hình lại.

---

## 2. CHỈ SỐ THỰC THỂ & TOÁN HỌC SÁT THƯƠNG (STATS & DAMAGE MATH)

Gameplay KHÔNG CÓ NĂNG LƯỢNG. Mọi thứ vận hành dựa trên Thời gian hồi chiêu (Cooldown).

### 2.1. Chỉ số Cơ bản (Base Stats)
Tất cả Entity (Tank, Boss, Tháp pháo) đều kế thừa bộ chỉ số này:
1.  `Max_HP` / `Current_HP`: Sinh lực.
2.  `ATK (Attack)`: Sức tấn công (duy nhất, không chia Physical/Energy).
3.  `Range`: Tầm đánh (pixels).
4.  `DEF_P (Physical Defense)`: Giáp vật lý — giảm thiểu sát thương kênh Physical.
5.  `DEF_E (Energy Defense)`: Giáp năng lượng — giảm thiểu sát thương kênh Energy.
6.  `Attack_Speed (AS)`: Tốc độ đánh thường (Đòn/giây).
    *   *Công thức:* `Base_Attack_Cooldown = 1.0 / AS` (giây).
7.  `Move_Speed`: Tốc độ di chuyển (GridUnits/giây).

**GHI CHÚ:** `Crit_Rate` và `Crit_Damage` KHÔNG phải base stat. Chúng là passive skill riêng của từng tank. Ví dụ: Iron Man passive cho +10% Crit Rate, Naruto passive (Nine-Tails Rage) cho +15% Crit Rate và 2.0 Crit Damage khi HP < 35%.

### 2.2. Động cơ Giải quyết Sát thương (Damage Resolution Engine)
Khi Nguồn sát thương (Attacker/Projectile) chạm vào Mục tiêu (Target), BẮT BUỘC xử lý theo thứ tự:

1.  **Sát thương thô (Raw Damage):**
    `Raw_DMG = Skill.Base_DMG + (Attacker.ATK * Skill.ATK_Scaling)`
2.  **Chọn kênh DEF (Damage Channel):**
    Mỗi skill/đạn xác định kênh sát thương: `Physical`, `Energy`, hoặc `True`.
    *   Physical → dùng `Target.DEF_P` để giảm thương
    *   Energy → dùng `Target.DEF_E` để giảm thương  
    *   True → bỏ qua hoàn toàn DEF
3.  **Hệ số Giảm thương (Mitigation Multiplier):**
    `Mitigation = 100 / (100 + Effective_DEF)`. *(VD: 100 DEF = giảm 50%, 200 DEF = giảm 66.6%).*
4.  **Sát thương cuối cùng (Final Damage):**
    `Final_DMG = Math.floor(Raw_DMG * Mitigation)`. Nếu `Raw_DMG > 0`, bắt buộc `Final_DMG` tối thiểu là 1.
5.  **Crit (nếu tank có passive crit):**
    Nếu tank có passive Crit_Rate > 0 và `Random(0,1) <= Crit_Rate` → `Final_DMG *= Crit_Damage`.

---

## 3. MÁY TRẠNG THÁI & HIỆU ỨNG KHỐNG CHẾ (STATE MACHINE & STATUS EFFECTS)

Bất kỳ Input nào từ Phaser Client gửi lên WebSocket Server đều phải được xác thực qua State Machine của Tank.

### 3.1. Entity Core States
Tank chỉ tồn tại ở MỘT trạng thái cốt lõi tại một thời điểm:
1.  `IDLE`: Đứng yên. Nhận mọi Input (Di chuyển, Ngắm, Bắn, Kỹ năng).
2.  `MOVING`: Đang di chuyển (Vận tốc > 0). Nhận mọi Input tấn công/ngắm.
3.  `CASTING`: Đang vận chiêu (Cast-time delay). Khóa Input Kỹ năng khác. Tùy thuộc vào thiết lập của chiêu mà có thể Khóa luôn Input Di chuyển (Bắt buộc đứng yên rặn chiêu).
4.  `DASHING`: Đang lướt/bay. Khóa toàn bộ Input di chuyển và xoay nòng. Tốc độ và hướng bị ép buộc theo thông số của kỹ năng Lướt. Miễn nhiễm với Slow.
5.  `STUNNED`: Bị choáng. Khóa MỌI Input. Lập tức ngắt (Interrupt) trạng thái `CASTING` hiện tại.
6.  `DEAD`: Máu = 0. Tắt Hitbox, không thể nhận mục tiêu. Đếm ngược hồi sinh.

### 3.2. Mảng Hiệu Ứng (Status Effects Array)
Mỗi Tank quản lý một mảng `Active_Effects`. Trừ dần `Duration` ở mỗi Tick.
*   **Stun (Choáng):** Ép Core State về `STUNNED`.
*   **Root (Trói chân):** Ép Vận tốc = 0. Cấm dùng kỹ năng Lướt/Bay. VẪN CHO PHÉP xoay nòng, đánh thường và dùng kỹ năng khác.
*   **Silence (Câm lặng):** Vô hiệu hóa Input Kỹ năng (Q, E, R). VẪN CHO PHÉP di chuyển và Đánh thường.
*   **Slow (Làm chậm):** Giảm % `Move_Speed`. *Luật Chống Cộng Dồn (Anti-stacking):* Nếu dính nhiều Slow, chỉ lấy hiệu ứng có % Slow cao nhất.
*   **Burn/Poison (DoT):** Gây `True_Damage` (Sát thương chuẩn bỏ qua giáp, không qua Mitigation) mỗi `Tick_Rate` (VD: 0.5s/lần).
*   **Invulnerable (Bất tử):** Ép mọi `Final_DMG` nhận vào = 0. Miễn nhiễm với mọi Debuff mới dính phải. 

---

## 4. HỆ THỐNG KỸ NĂNG & ĐẠN ĐẠO (SKILLS & PROJECTILES)

Mọi chiến thuật dựa trên quản lý bộ đếm ngược Cooldown và số lượng đạn (Charges).

### 4.1. Bộ Kỹ năng Tiêu chuẩn (Skill Slots)
Mỗi xe tăng có chính xác 3 khe kỹ năng:
*   `Attack (Mouse Left)`: Basic Attack. Bắn liên tục. Cooldown được tính từ chỉ số `Attack_Speed`. Không giới hạn đạn.
*   `Skill E (E)`: Kỹ năng phòng thủ/Cơ động/Lướt. Cooldown trung bình (8s - 15s).
*   `Skill Space (SPACE)`: Chiêu cuối (Ultimate). Cooldown dài (30s - 60s). Tạo đột biến giao tranh.

*(Thời gian hồi chiêu thực tế: `Actual_Cooldown = Base_Cooldown * (1.0 - CDR)`)*

### 4.2. Phân loại Đạn Đạo (Projectile Archetypes)
Không code kỹ năng rời rạc. Kế thừa từ các nguyên mẫu sau để Server dễ quản lý:
1.  **Hitscan / Laser:** Quét tia (Raycast) tức thời trong 1 Frame. Không có tốc độ bay. Gây sát thương ngay lập tức cho mục tiêu nằm trên đường thẳng.
2.  **Linear Projectile:** Đạn vật lý bay thẳng với `Velocity` cố định. Chạm Địch hoặc Tường cứng -> Kích nổ -> Hủy (`Destroy`).
3.  **Piercing Projectile (Xuyên thấu):** Bay thẳng, đi xuyên qua và gây sát thương cho TOÀN BỘ xe địch nó chạm. Bỏ qua logic hủy khi chạm địch. Chỉ hủy khi bay hết `Max_Range` hoặc chạm Tường đá.
4.  **Bouncing Projectile (Đạn nảy):** Chạm Tường đá KHÔNG bị hủy. Nảy lại theo công thức toán học: 
    `Reflect_Vec = Velocity - 2 * DotProduct(Velocity, Wall_Normal) * Wall_Normal`. Tự hủy sau khi đạt `Max_Bounces`.
5.  **Lob / Artillery (Pháo bổng):** Đạn bay theo đường Parabola (mô phỏng trục Z). Bỏ qua mọi vật cản và Entity. Rơi xuống tọa độ X,Y định sẵn sau `Air_Time` giây. Nổ gây sát thương diện rộng (AoE).
6.  **Homing Projectile (Đạn đuổi):** Khóa mục tiêu. Ở mỗi Frame, nội suy vector vận tốc hướng về mục tiêu. Có tham số `Turn_Rate` (Góc ngoặt tối đa/giây). Nếu người chơi chạy đủ nhanh và lách cua vuông góc, đạn bẻ lái không kịp sẽ bay trượt đập vào tường.

---

## 5. TIẾN TRÌNH TIẾN HÓA TRONG TRẬN (IN-MATCH EVOLUTION)

Không có Cửa hàng mua đồ trong trận. Người chơi cày cấp để Tank tự to ra và thay đổi ngoại hình.

### 5.1. Cơ chế Kinh Nghiệm (EXP)
*   Khởi đầu: **Level 1 (Tier 1)**. Tối đa: **Level 5 (Tier 5)**.
*   Nguồn EXP: Tự động cộng nhỏ giọt theo thời gian, Phá thùng gạch (+10 EXP), Giết lính (+15 EXP), Hỗ trợ hạ địch (+25 EXP), Kết liễu địch (+50 EXP), Nhặt Cầu EXP trên bản đồ.

### 5.2. Cây Tiến Hóa (Evolution Roadmap) — 5 Level = 5 Visual Tier
Mỗi Level lên = Tank đổi ngoại hình (sprite mới) + Hitbox to hơn một chút.

*   **Level 1 (Tier 1):** Xe nguyên bản. Hitbox nhỏ nhất. Mở khóa `Basic Attack` và `Skill E`.
*   **Level 2 (Tier 2):** Sprite thay đổi nhẹ. Hitbox x1.05. Base Stats x 1.1.
*   **Level 3 (Tier 3):** Sprite hầm hố hơn. Hitbox x1.10. Base Stats x 1.25. Mở khóa Passive Skill.
*   **Level 4 (Tier 4):** Sprite nâng cấp. Hitbox x1.15. Base Stats x 1.4.
*   **Level 5 (Tier 5 - Tối thượng):** Sprite hoàn chỉnh. Dưới chân tỏa VFX Hào quang. Hitbox x1.20. Base Stats x 1.6.

---

## 6. MÔI TRƯỜNG BẢN ĐỒ VÀ VẬT PHẨM (ENVIRONMENT & PICKUPS)

Bản đồ là hệ thống Grid/Tilemap.

### 6.1. Interactive Terrain (Địa hình tương tác)
*   **Hard Wall (Tường Đá/Sắt):** Vĩnh cửu. Chặn xe và đạn.
*   **Destructible Wall (Tường Gạch/Thùng gỗ):** Chặn xe và đạn, NHƯNG có thanh `HP`. Chịu sát thương từ người chơi. Khi HP = 0, vỡ nát thành khoảng trống đi lại được. Tạo chiến thuật đục tường mai phục.
*   **Water / Lava (Vực/Nước):** Chặn di chuyển của Xe. **Nhưng Đạn và Tầm nhìn có thể bay xuyên qua mặt nước bình thường**. Dùng làm rào cản đứng bắn cấu rỉa.
*   **Teleporter (Cổng dịch chuyển):** Cặp cổng A-B. Xe dẫm vào A -> Lập tức set tọa độ sang B.
    *   *Luật Chống Kẹt (Anti-loop):* Xe vừa qua cổng nhận buff `Invulnerable` 1 giây. Cổng B rơi vào trạng thái Cooldown cục bộ 3 giây (chỉ áp dụng với chiếc xe đó) để xe không bị hút ngược lại ngay lập tức.

### 6.2. Pickups (Vật phẩm nhặt)
Rớt từ điểm Spawner trên map hoặc khi đục Tường gạch. Lái xe đè lên để nhặt.
*   `Repair Kit` (Máu): Hồi lập tức 35% Max HP.
*   `Clock Reset` (Đồng hồ): Lập tức đưa Current_Cooldown của mọi kỹ năng về 0 (Sẵn sàng sử dụng).
*   `Damage Amplifier` (Sao đỏ): Tăng 100% Sát thương đánh thường trong 10 giây.
*   `Shield Generator` (Khiên ảo): Cấp lớp Khiên bằng 30% Max HP. Không giới hạn thời gian tồn tại, chỉ biến mất khi bị bắn vỡ.

---

## 7. CÁC CHẾ ĐỘ CHƠI PVP (PVP GAME MODES - STRICT RULES)

Hệ thống Server cần chạy các lớp `GameModeManager` riêng rẽ để quản lý logic trận đấu.

### 7.1. Chế Độ Đấu Đội (Team Deathmatch / Bounty Hunter)
*   **Mục tiêu:** 5v5. Đội đạt **25 Kills** trước lập tức Thắng. (Hoặc hết giờ 10 phút, đội cao điểm hơn thắng).
*   **Scoring:** Tính Điểm cho người Last-hit (kết liễu). Nếu địch nhảy xuống Lava tự sát -> Người cuối cùng gây sát thương lên kẻ đó trong 5s vừa qua sẽ được tính Kill.
*   **Safe Zone & Respawn:**
    *   Hồi sinh tại Safe Zone nhà mình sau 5 giây.
    *   *Safe Zone Aura:* Kẻ địch bước vào Safe Zone phe ta nhận 2000 True Damage/giây.
    *   *Spawn Protection:* Xe vừa sinh ra có `Invulnerable` 3 giây chống ép sân. HỦY NGAY LẬP TỨC nếu xe khai hỏa đánh thường hoặc dùng chiêu.

### 7.2. Chế Độ Phá Căn Cứ (Base Destruction - MOBA Lite)
*   **Mục tiêu:** Phá hủy `Main_Core` (Nhà chính) của phe địch. Không có lane lính phức tạp.
*   **Luật Tháp Pháo (Turret Aggro Logic) - YÊU CẦU LẬP TRÌNH CHUẨN:**
    *   Đạn của Trụ là tia Laser `Homing` (Đuổi chắc chắn trúng, không thể né). Tầm bắn 700. Tốc độ bắn 1 phát/s.
    *   *Sát thương tăng tiến (Heat-up):* Phát đạn đầu 200 DMG. Nếu tiếp tục khóa nòng vào cùng 1 mục tiêu, mỗi phát sau sát thương tăng thêm 25% (200 -> 250 -> 312...). Nếu đổi mục tiêu, sát thương reset về 200. Ép người chơi phải thay phiên nhau tank trụ.
    *   *Luật Chuyển Mục tiêu (Aggro Switch):* Ưu tiên bắn lính -> Bắn Tank gần nhất. **QUY TẮC VÀNG:** Nếu Tank Địch A đang trong tầm trụ ta, mà A **gây sát thương** lên Tank Ta B -> Trụ LẬP TỨC bỏ qua lính, khóa mục tiêu vào A để bảo vệ đồng đội.
*   **Luật Bất Tử Nhà Chính:** `Main_Core` miễn nhiễm mọi sát thương (Invulnerable) nếu phe đó còn ít nhất 1 `Turret` trên bản đồ chưa bị phá.

### 7.3. Chế Độ Cướp Cờ (Capture The Flag - TƯƠNG TÁC PHỨC TẠP NHẤT)
*   **Mục tiêu:** Cướp cờ địch mang về chạm vào Căn Cứ nhà mình **3 lần**.
*   **Máy Trạng Thái Cờ (Flag State Machine):**
    1.  `AT_BASE`: Đang yên vị tại nhà.
    2.  `CARRIED`: Đang bị nhặt (Tọa độ Cờ bám theo tọa độ Tank cầm cờ).
    3.  `DROPPED`: Rơi tự do giữa map do xe cầm cờ bị chết. Tồn tại 15 giây rồi tự biến về Base.
*   **Luật Tương Tác Cờ (Flag Interaction Rules):**
    *   *Nhặt Cờ:* Tank Đỏ đè lên Cờ Xanh (`AT_BASE` hoặc `DROPPED`) -> Cờ Xanh chuyển sang `CARRIED`.
    *   *Debuff Người Cầm Cờ:* Giảm 20% `Move_Speed`. Vô hiệu hóa tàng hình vào bụi (Luôn hiện trên Minimap).
    *   *Luật Cấm Lướt (Anti-Dash Rule):* Người cầm cờ TUYỆT ĐỐI CẤM dùng các kỹ năng Lướt/Bay/Dịch chuyển. Nếu bấm dùng -> Kỹ năng vẫn tung ra, nhưng Cờ lập tức văng khỏi người, chuyển thành `DROPPED` tại vị trí bắt đầu lướt.
    *   *Thu Hồi (Return):* Cờ Ta đang rơi `DROPPED`. Tank Ta đè lên -> Cờ lập tức dịch chuyển về `AT_BASE`.
    *   *Ghi Điểm (Capture):* Tank Đỏ mang Cờ Xanh đè lên Cờ Đỏ tại Base Đỏ. **ĐIỀU KIỆN TIÊN QUYẾT:** Cờ Đỏ PHẢI ĐANG Ở `AT_BASE`. Nếu Cờ Đỏ đang bị mất/rơi ngoài đường, Tank Đỏ mang cờ về không được cộng điểm, phải đứng thủ chờ đồng đội thu hồi Cờ Đỏ về.

---

## 8. CHẾ ĐỘ PVE PHÓ BẢN (CO-OP DUNGEON & BOSS FIGHTS)

Chế độ Co-op 1-4 người vượt ải. Logic AI chạy độc lập trên Server.

### 8.1. Trình Quản lý Màn Chơi (Room & Wave Manager)
*   Map chia thành 3 Phòng (Rooms) nối tiếp, ngăn cách bởi `Laser_Wall` (Bức tường bất tử).
*   Mỗi phòng spawn N đợt quái (Waves).
*   Điều kiện qua phòng: Mảng `Active_Enemies.length === 0` -> Xóa `Laser_Wall`, sinh rương tiếp tế, mở đường sang phòng tiếp theo.

### 8.2. Hệ thống AI Quái vật (Mob Behavior Trees)
*   **Melee Swarmer (Nhện cơ khí):** Thuật toán `A* Pathfinding`. Áp sát người chơi gần nhất. Đạt khoảng cách `< 60px` -> Gây sát thương chạm (Contact Damage).
*   **Ranged Kiter (Pháo di động):** Giữ khoảng cách chiến đấu (Range = 350). Nếu người chơi áp sát, nó bỏ chạy lùi lại. Đủ xa, đứng yên 1 giây xuất hiện vạch Laser Đỏ cảnh báo (Telegraph) -> Bắn đạn đường thẳng tốc độ cao.
*   **Kamikaze Bomber (Xe bom):** Tốc độ x2. Bỏ qua mọi mục tiêu, lao thẳng vào 1 người chơi. Chạm -> Khựng lại 0.5s -> Nổ AoE sát thương khổng lồ. Buộc người chơi phải xả đạn giết nó từ xa.

### 8.3. Cơ chế Đánh Boss (Boss Mechanics - Bullet Hell)
Trùm ở phòng cuối. Miễn nhiễm mọi CC. Chuyển Phase theo % HP.
*   **Phase 1 (100% - 60% HP):**
    *   Liên tục khóa mục tiêu bằng 3 vòng tròn đỏ dưới đất. 1.5 giây sau dội pháo thẳng xuống. Ép người chơi phải liên tục di chuyển không được đứng yên xả đạn.
*   **Phase 2 (60% - 30% HP) - Enrage:**
    *   Boss bật `Reflect Shield` (Khiên Phản Sát Thương). Mọi đòn đánh của người chơi sẽ bị dội ngược 30% sát thương vào chính họ. Bài toán kiểm tra kỷ luật: "Ngừng bắn".
    *   Thả 4 Tháp Laser ở 4 góc phòng nối tia với nhau, ép góc di chuyển của người chơi.
*   **Phase 3 (30% - 0% HP) - Bullet Hell:**
    *   Boss ra giữa map, đứng yên.
    *   Phun ra hàng trăm viên đạn hình tròn bay cực chậm theo hình xoắn ốc (Spiral Pattern) liên tục không ngừng. Người chơi phải thể hiện kỹ năng "luồn kim" (Micro-dodging) qua các khe hở siêu nhỏ của lưới đạn để bắn Boss.

---

## 9. HỆ THỐNG METAGAME VÀ GARAGE (OUT-MATCH PROGRESSION)

### 9.1. Tiền tệ (Currencies)
*   **Bạc (Silver):** Kiếm được sau mỗi trận đấu. Dùng để nâng cấp xe.
*   **Vàng (Gold):** Tiền Premium. Dùng mở khóa Xe hiếm, quay Gacha, Mua Skin.

### 9.2. Hệ thống Nâng Cấp Linh Kiện (Parts Upgrade)
Mỗi Xe Tăng lưu trong Database có 4 Khe phụ tùng. Nâng cấp bằng Bạc sẽ cộng thẳng chỉ số vào `Base Stats` khi đưa xe vào GameServer.
1.  **Nòng Pháo (Cannon):** Tăng `% Attack_Damage` và `% Crit_Rate`.
2.  **Khung Xe (Chassis):** Tăng `% Max_HP` và cộng thẳng `Armor`.
3.  **Bánh Xích (Tracks):** Tăng cố định `Move_Speed` và `Hull_Turn_Rate`.
4.  **Hệ thống Tản Nhiệt (Cooling Engine):** Tăng `% Cooldown_Reduction` (Giảm hồi chiêu) và `Attack_Speed`.

---

## 10. KIẾN TRÚC DỮ LIỆU TYPESCRIPT (DATA SCHEMAS FOR AGENTS)

> ⚠️ These schemas are a REFERENCE COPY. The actual source of truth is in `packages/shared/src/types/`. If these diverge, the code wins.

### 10.1. Base Stats & Tank Snapshot
```typescript
// 7 base stats — NO crit, NO shield, NO CDR as base stats
interface TankAttributes {
  hp: number;
  atk: number;           // Single attack stat
  range: number;          // Pixels
  defP: number;           // Physical defense
  defE: number;           // Energy defense
  attackSpeed: number;    // Attacks per second
  speed: GridUnits;       // Movement speed
}

// What the server sends to clients each snapshot tick
interface TankSnapshot {
  entityId: EntityId;
  playerId: PlayerId;
  tankId: TankId;
  position: Vector2;
  hullRotation: Radians;
  turretRotation: Radians;
  hp: number;
  maxHp: number;
  activeEffects: StatusEffect[];
  isAlive: boolean;
  team: TeamId;
}

// 6 status effect types (Root/Silence are effects, NOT TankStates)
interface StatusEffect {
  id: string;
  type: 'Stun' | 'Root' | 'Silence' | 'Slow' | 'Burn' | 'Invulnerable';
  value?: number;       // e.g. 0.3 = Slow 30%
  durationLeft: number; // Milliseconds countdown
}
```

### 10.2. Tank State Machine (6 States)
```typescript
enum TankState {
  Idle     = 'Idle',
  Moving   = 'Moving',
  Casting  = 'Casting',   // Skill cast animation
  Dashing  = 'Dashing',   // Movement skill (immune to Slow)
  Stunned  = 'Stunned',   // Hard CC — blocks ALL input
  Dead     = 'Dead',      // HP = 0
}
```

### 10.3. Skill & Projectile Schema
```typescript
// 3 skill slots only
enum SkillSlot { Attack = 'Attack', E = 'E', Space = 'Space' }

// 3 damage channels
enum DamageChannel { Physical = 'Physical', Energy = 'Energy', True = 'True' }

// 7 projectile archetypes
enum ProjectileArchetype {
  Linear    = 'Linear',
  Piercing  = 'Piercing',
  Bouncing  = 'Bouncing',
  Hitscan   = 'Hitscan',
  Lob       = 'Lob',
  Homing    = 'Homing',
  Boomerang = 'Boomerang',
}

interface SkillDefinition {
  slot: SkillSlot;
  name: string;
  cooldownSec: Seconds;
  archetype: ProjectileArchetype;
  range: number;
  damageFormula: {
    baseDamage: number;
    atkScaling: number;    // Single scaling (no AD/AP split)
    channel: DamageChannel;
  };
}

interface ProjectileState {
  id: string;
  ownerId: string;
  archetype: ProjectileArchetype;
  damagePayload: number;
  channel: DamageChannel;
  position: Vector2;
  velocity: Vector2;
  distanceTraveled: number;
  maxRange: number;
  maxBounces?: number;
  bouncesLeft?: number;
}
```

### 10.4. Network Messages
```typescript
// Client → Server
interface PlayerInput {
  moveDir: Vector2 | null;
  aimAngle: Radians;
  fire: boolean;
  skillE: boolean;
  skillSpace: boolean;
  seq: number;
}

// Server → Client (broadcast at 20Hz)
interface GameSnapshot {
  tick: number;
  timestamp: Milliseconds;
  tanks: TankSnapshot[];
  projectiles: ProjectileState[];
  mapDelta: MapDeltaEntry[];
  lastProcessedInput: number; // Per-player seq for reconciliation
}
```