/**
 * world.js - 處理 3D 場景背景與物理世界
 */

// 物理碰撞群組定義 (Bitmask)
const COLLISION_GROUPS = {
    PLAYER: 1,
    ENVIRONMENT: 2, // 地板、樹木、房屋
    BULLET: 4,
    ENEMY: 8,
    ITEM: 16
};

class World {
    constructor() {
        // --- 1. 初始化 Three.js 渲染器與場景 (視覺部分) ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xa0a0a0); // 背景設為灰色，讓 3D 物件更明顯
        this.scene.fog = new THREE.Fog(0xa0a0a0, 10, 50); // 加入霧氣效果，遠處物體會漸漸消失，增加空間感

        // --- 2. 初始化 Cannon.js 物理世界 (運算部分) ---
        // 物理世界是隱形的，它在背後幫我們計算重力、速度、碰撞
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, -9.82, 0); // 設定重力
        this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();

        // --- 修正穿牆問題 ---
        this.physicsWorld.solver.iterations = 20; // 提升物理運算精確度，避免高速穿透
        this.physicsWorld.defaultContactMaterial.friction = 0.4;
        this.physicsWorld.defaultContactMaterial.restitution = 0.0;

        // --- 3. 建立燈光 ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 環境光
        this.scene.add(ambientLight);

        const light = new THREE.DirectionalLight(0xffffff, 0.8); // 平行光 (太陽光)
        light.position.set(10, 20, 10);
        light.castShadow = true;
        this.scene.add(light);

        // --- 4. 建立地板 ---
        this.createGround();

        // --- 5. 建立場景物件 ---
        this.targets = [];
        this.staticObjects = []; // 存放不會動但具備碰撞的靜態視覺與物理物件

        // 道具與怪物陣列 (交由 main.js 控制)
        this.items = [];
        this.enemies = [];

        // 隨機擺放標靶
        for (let i = 0; i < 5; i++) {
            this.createTarget();
        }

        // 隨機生成樹木
        for (let i = 0; i < 15; i++) {
            const x = (Math.random() - 0.5) * 80;
            const z = (Math.random() - 0.5) * 80;
            // 避免在玩家出生點(0,0)附近生成
            if (Math.abs(x) > 5 || Math.abs(z) > 5) {
                this.createTree(x, 0, z);
            }
        }

        // 隨機生成房屋
        for (let i = 0; i < 5; i++) {
            const x = (Math.random() - 0.5) * 70;
            const z = (Math.random() - 0.5) * 70;
            if (Math.abs(x) > 10 || Math.abs(z) > 10) {
                this.createHouse(x, 0, z);
            }
        }

        // 隨機生成補給品 (彈藥與血包)
        for (let i = 0; i < 5; i++) {
            this.createAmmoBox((Math.random() - 0.5) * 60, 0.5, (Math.random() - 0.5) * 60);
            this.createHealthKit((Math.random() - 0.5) * 60, 0.5, (Math.random() - 0.5) * 60);
        }

        // 隨機生成怪物
        for (let i = 0; i < 5; i++) {
            const ex = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 30);
            const ez = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 30);
            this.createEnemy(ex, 0, ez);
        }
    }

    createEnemy(x, y, z) {
        // 由於 Enemy 類別定義在外部，這裡只負責實例化並加入陣列
        if (typeof Enemy !== 'undefined') {
            const enemy = new Enemy(x, y, z, this.scene, this.physicsWorld);
            this.enemies.push(enemy);
        }
    }

    createAmmoBox(x, y, z) {
        // 使用三顆並排的金色圓柱體代表彈藥
        const ammoGroup = new THREE.Group();
        ammoGroup.position.set(x, y + 0.5, z);

        const bulletGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8);
        const bulletMat = new THREE.MeshPhongMaterial({ color: 0xf1c40f }); // 金色子彈殼

        for (let j = -1; j <= 1; j++) {
            const b = new THREE.Mesh(bulletGeo, bulletMat);
            b.position.set(j * 0.3, 0, 0); // 排列
            b.castShadow = true;
            ammoGroup.add(b);
        }

        // 以一個透明防護罩或底盤作為基底 (可選)
        const baseGeo = new THREE.BoxGeometry(1.2, 0.1, 0.6);
        const baseMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = -0.35;
        ammoGroup.add(baseMesh);

        this.scene.add(ammoGroup);

        // 將原本的 mesh 改為這個 group
        this.items.push({ type: 'ammo', mesh: ammoGroup, amount: 15 });
    }

    createHealthKit(x, y, z) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshPhongMaterial({ color: 0xffffff }); // 白色底 (暫不加紅十字避免複雜)
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        this.scene.add(mesh);

        this.items.push({ type: 'health', mesh: mesh, amount: 30 });
    }

    createGround() {
        // Three.js 地板視覺效果 (改為草地色彩)
        const geometry = new THREE.PlaneGeometry(100, 100);
        const material = new THREE.MeshPhongMaterial({ color: 0x3b7a57 }); // 採用草地綠
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2; // 讓平面躺下
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Cannon.js 地板物理實體
        const groundBody = new CANNON.Body({
            mass: 0, // 質量為 0 代表是固定不動的靜態物體
            shape: new CANNON.Plane(),
            collisionFilterGroup: COLLISION_GROUPS.ENVIRONMENT,
            collisionFilterMask: -1 // 與所有群組碰撞
        });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.physicsWorld.addBody(groundBody);
    }

    createTarget() {
        // 設定隨機位置，這會讓每次遊戲開啟時方塊都在不同地方
        const x = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 20;
        const y = 2; // 從空中掉下來

        // --- Three.js 視覺部分 ---
        // BoxGeometry(寬, 高, 深)
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true; // 讓方塊會產生陰影
        this.scene.add(mesh);

        // --- Cannon.js 物理部分 ---
        // 物理物體的形狀通常要跟視覺物體一致
        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)); // Cannon 是從中心算一半長度
        const body = new CANNON.Body({
            mass: 5, // 質量為 5 (kg)，有質量的物體會受重力影響
            position: new CANNON.Vec3(x, y, z),
            shape: shape
        });
        this.physicsWorld.addBody(body);

        // 追蹤這個標靶，便於在 update 函式中同步「身體」與「皮膚」
        this.targets.push({ mesh, body });
    }

    createTree(x, y, z) {
        // ... (Tree Visual)
        const treeGroup = new THREE.Group();
        treeGroup.position.set(x, y, z);

        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
        const trunkMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
        trunkMesh.position.y = 1;
        trunkMesh.castShadow = true;
        trunkMesh.receiveShadow = true;
        treeGroup.add(trunkMesh);

        const leavesGeo = new THREE.ConeGeometry(2, 4, 8);
        const leavesMat = new THREE.MeshPhongMaterial({ color: 0x228B22 });
        const leavesMesh = new THREE.Mesh(leavesGeo, leavesMat);
        leavesMesh.position.y = 4;
        leavesMesh.castShadow = true;
        leavesMesh.receiveShadow = true;
        treeGroup.add(leavesMesh);

        this.scene.add(treeGroup);

        const trunkShape = new CANNON.Cylinder(0.5, 0.5, 2, 8);
        const trunkBody = new CANNON.Body({
            mass: 0,
            position: new CANNON.Vec3(x, y + 1, z),
            collisionFilterGroup: COLLISION_GROUPS.ENVIRONMENT,
            collisionFilterMask: -1
        });
        trunkBody.addShape(trunkShape);
        const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        trunkBody.quaternion.copy(q);
        this.physicsWorld.addBody(trunkBody);
    }

    createHouse(x, y, z) {
        // 多層房屋參數設定
        const width = 10;
        const depth = 10;
        const height = 4; // 單層高度
        const wallThickness = 0.5; // 稍厚的牆壁避免穿透

        const houseGroup = new THREE.Group();
        houseGroup.position.set(x, y, z);

        // 建造物理物件 (Compound Body)
        const houseBody = new CANNON.Body({
            mass: 0, // 0 質量代表靜止
            position: new CANNON.Vec3(x, y, z)
        });

        // 材質
        const wallMat = new THREE.MeshPhongMaterial({ color: 0xD3D3D3 });
        const floorMat = new THREE.MeshPhongMaterial({ color: 0xA9A9A9 });
        const stairMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 }); // 木頭色樓梯

        // --- 輔助函式：建立一塊方塊牆壁/地板 ---
        const addPart = (w, h, d, px, py, pz, mat, rotAxis = null, rotAngle = 0) => {
            // Three.js 視覺
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(px, py, pz);
            if (rotAxis) {
                if (rotAxis === 'x') mesh.rotation.x = rotAngle;
                if (rotAxis === 'y') mesh.rotation.y = rotAngle;
                if (rotAxis === 'z') mesh.rotation.z = rotAngle;
            }
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            houseGroup.add(mesh);

            // Cannon.js 物理
            const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
            const offset = new CANNON.Vec3(px, py, pz);
            let orientation = undefined;
            if (rotAxis) {
                orientation = new CANNON.Quaternion();
                const axisVec = new CANNON.Vec3(rotAxis === 'x' ? 1 : 0, rotAxis === 'y' ? 1 : 0, rotAxis === 'z' ? 1 : 0);
                orientation.setFromAxisAngle(axisVec, rotAngle);
            }
            houseBody.addShape(shape, offset, orientation);
        };

        // --- 1. 一樓地板 ---
        // 稍微高於地面避免與草地 Z-fighting
        addPart(width, wallThickness, depth, 0, wallThickness / 2, 0, floorMat);

        // --- 2. 一樓牆壁 ---
        // 後牆 (完整)
        addPart(width, height, wallThickness, 0, height / 2, -depth / 2 + wallThickness / 2, wallMat);
        // 左牆 (完整)
        addPart(wallThickness, height, depth, -width / 2 + wallThickness / 2, height / 2, 0, wallMat);
        // 右牆 (完整)
        addPart(wallThickness, height, depth, width / 2 - wallThickness / 2, height / 2, 0, wallMat);
        // 前牆 (開門，分成左右兩半)
        const doorWidth = 3;
        const frontWallW = (width - doorWidth) / 2;
        addPart(frontWallW, height, wallThickness, -width / 2 + frontWallW / 2, height / 2, depth / 2 - wallThickness / 2, wallMat); // 前左
        addPart(frontWallW, height, wallThickness, width / 2 - frontWallW / 2, height / 2, depth / 2 - wallThickness / 2, wallMat); // 前右
        // 前方門上的橫樑
        const topDoorH = 1;
        addPart(doorWidth, topDoorH, wallThickness, 0, height - topDoorH / 2, depth / 2 - wallThickness / 2, wallMat);

        // --- 3. 二樓地板 ---
        // 為二樓留下爬上來的半截空間 (深度縮減)
        const secondFloorDepth = depth - 3;
        addPart(width, wallThickness, secondFloorDepth, 0, height, -1.5, floorMat);

        // --- 4. 斜坡（樓梯替代）---
        // 製作一個斜坡讓玩家走上二樓的地板
        const slopeW = 2;
        const slopeD = 5;
        const slopeH = 0.5; // 板子厚度
        const angle = -Math.PI / 4; // 傾角 45 度
        // 計算斜坡中點位置
        addPart(slopeW, slopeH, slopeD, 0, height / 2, depth / 2 - 2, stairMat, 'x', angle);

        // 將組合好的房屋加入場景與物理世界
        this.scene.add(houseGroup);
        this.physicsWorld.addBody(houseBody);
    }

    // 每一幀更新，同步物理引擎的位置到 3D 渲染器
    update(deltaTime) {
        this.physicsWorld.step(1 / 60, deltaTime);

        this.targets.forEach(target => {
            target.mesh.position.copy(target.body.position);
            target.mesh.quaternion.copy(target.body.quaternion);
        });
    }
}
