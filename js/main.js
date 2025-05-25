import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let scene, camera, renderer, water, controls, clock, sun, sand, waterVolume;
let causticTexture;
let fishes = [], plants = [], rocks = [];

// 設定パラメータを水槽表現用に調整
const params = {
    waterColor: '#5b9bd5',   // 少し青緑よりの水色
    waterOpacity: 0.2,       // 透明度を上げる
    // lightIntensity, numLightShafts, lightShaftOpacityを削除
    sunY: 30,
    cameraY: 8, 
    cameraZ: 16,
    fishSpeed: 0.6,         // 魚の泳ぐ速さ
    fishCount: 8,           // 魚の数
    plantDensity: 0.7,      // 水草の密度
    plantVariety: 3,        // 水草の種類の数
};

// 砂地生成関数 (シンプルに保持)
function generateSandGeometry(size, segments, height) {
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    for (let i = 0; i < geometry.attributes.position.count; i++) {
        const x = geometry.attributes.position.getX(i);
        const y = geometry.attributes.position.getY(i);
        const noise =
            0.2 * Math.sin(x * 0.5) * Math.cos(y * 0.5) +
            0.1 * Math.sin(x * 2.0 + y) +
            0.05 * Math.cos(y * 3.0 + x * 0.5) +
            0.07 * (Math.random() - 0.5);
        geometry.attributes.position.setZ(i, noise * height);
    }
    geometry.computeVertexNormals();
    return geometry;
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111122); // 暗い背景でコントラストを強調
    clock = new THREE.Clock();

    // カメラ
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, params.cameraY, params.cameraZ);

    // レンダラー
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // コントロール
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    // シンプルな環境光のみを残す
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    
    // 太陽光の参照は残す（Waterオブジェクトで使用）
    sun = new THREE.Vector3(0, params.sunY, 0);

    // 水槽サイズを定義
    const aquariumSize = 20;
    const aquariumHeight = 8;

    // 水のボリューム表現をよりリアルに
    const waterVolumeGeometry = new THREE.BoxGeometry(aquariumSize, aquariumHeight, aquariumSize);
    const waterVolumeMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(params.waterColor),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 0.99,        // ほぼ完全に透明に
        transparent: true,
        opacity: params.waterOpacity,
        ior: 1.33,                 // 水の屈折率
        attenuationColor: new THREE.Color(0x056f92), // 水の光吸収色
        attenuationDistance: 15.0, // 光の減衰距離
    });
    waterVolume = new THREE.Mesh(waterVolumeGeometry, waterVolumeMaterial);
    waterVolume.position.y = aquariumHeight / 2;
    scene.add(waterVolume);

    // より複雑な砂地
    const sandSize = aquariumSize - 0.5;  // 水槽よりやや小さく
    const sandSegments = 80;
    const sandHeight = 0.3;
    const sandGeometry = generateSandGeometry(sandSize, sandSegments, sandHeight);
    const sandMaterial = new THREE.MeshStandardMaterial({
        color: 0xfbecc4,
        roughness: 0.8,
        metalness: 0.1,
    });
    sand = new THREE.Mesh(sandGeometry, sandMaterial);
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = 0.1;
    scene.add(sand);

    // 水面
    const waterGeometry = new THREE.PlaneGeometry(aquariumSize - 0.5, aquariumSize - 0.5, 32, 32);
    water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load(
            'https://threejs.org/examples/textures/waternormals.jpg',
            function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }
        ),
        sunDirection: new THREE.Vector3(0, 1, 0),
        sunColor: 0xffffff,
        waterColor: new THREE.Color(params.waterColor),
        distortionScale: 1.5,
        fog: false,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = aquariumHeight - 0.1;
    scene.add(water);
    
    // 上からの照明
    const topLight = new THREE.DirectionalLight(0xffffff, 1.5);
    topLight.position.set(0, 25, 0);
    topLight.target.position.set(0, 0, 0);
    scene.add(topLight);
    scene.add(topLight.target);

    // コースティクステクスチャをロード（光の集束パターン用）
    const textureLoader = new THREE.TextureLoader();
    causticTexture = textureLoader.load(
        'https://raw.githubusercontent.com/spite/codevember-2016/master/caustics/assets/caustic_01.jpg',
        function(texture) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(5, 5);
            
            // コースティクスの床への投影
            const causticPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(aquariumSize - 1, aquariumSize - 1),
                new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 0.7,
                    blending: THREE.AdditiveBlending,
                })
            );
            causticPlane.rotation.x = -Math.PI / 2;
            causticPlane.position.y = 0.15; // 砂の上に配置
            scene.add(causticPlane);
        }
    );
    
    // 光の光柱を削除

    // GUI拡張
    const gui = new GUI();
    gui.addColor(params, 'waterColor').name('Water Color').onChange(val => {
        water.material.uniforms.waterColor.value.set(val);
        waterVolume.material.color.set(val);
    });

    gui.add(params, 'waterOpacity', 0.05, 0.5).name('Water Density').onChange(val => {
        waterVolume.material.opacity = val;
    });
    
    // カメラ位置を水槽の中心に近づける
    camera.position.set(0, 4, 12); // 高さを下げ、距離も近づける
    controls.target.set(0, 3, 0); // 水槽の中央部分を見るように
    controls.update();

    // 水草と岩の制御
    const environmentFolder = gui.addFolder('Environment');
    
    // 水草の密度と数を調整可能に
    environmentFolder.add(params, 'plantDensity', 0.1, 2.0).name('Plant Density').onChange(val => {
        createPlants(aquariumSize);
        createRocks(aquariumSize); // 岩も再配置
    });
    
    // 水草の種類のバリエーションを制御するパラメータを追加
    params.plantVariety = 3; // デフォルトは3種類
    environmentFolder.add(params, 'plantVariety', 1, 5).step(1).name('Plant Variety').onChange(val => {
        createPlants(aquariumSize);
    });
    
    // 鮮やかな黄緑色の水草の色
    const vibrantGreen = new THREE.Color(0x7cfc00); // 明るい黄緑色
    environmentFolder.addColor({plantColor: '#7cfc00'}, 'plantColor').name('Plant Color').onChange(val => {
        // 既存の水草の色を変更
        plants.forEach(plant => {
            plant.traverse(child => {
                if (child instanceof THREE.Mesh && child.material) {
                    if (child.material.color) {
                        // 茎と葉で色の違いを保持しつつ色相を変更
                        if (child.material.color.g > 0.5) { // 葉の部分
                            child.material.color.set(val);
                        } else { // 茎の部分
                            // 茎は少し暗めに
                            const stemColor = new THREE.Color(val);
                            stemColor.multiplyScalar(0.7);
                            child.material.color.set(stemColor);
                        }
                    }
                } else if (child instanceof THREE.Points && child.material) {
                    // ウィローモスの場合
                    child.material.color.set(val);
                }
            });
        });
    });

    // 初期化時に水槽の要素を追加（これが重要！）
    createFishes(aquariumSize, aquariumHeight);
    createPlants(aquariumSize, vibrantGreen); // 鮮やかな黄緑色を渡す
    createRocks(aquariumSize);

    window.addEventListener('resize', onWindowResize);
    
    // カメラ位置監視関数を追加
    controls.addEventListener('change', function() {
        const isUnderwater = camera.position.y < water.position.y;
        if (isUnderwater) {
            scene.fog = new THREE.FogExp2(0x004466, 0.05); // 水中の霧
            scene.background = new THREE.Color(0x004466); // 水中の背景色
        } else {
            scene.fog = null;
            scene.background = new THREE.Color(0x111122); // 標準の背景色
        }
    });
    
    animate();
}

// 光の光柱を作成する関数
function createLightShafts(aquariumSize, aquariumHeight) {
    // 既存の光柱をクリア
    lightShafts.forEach(shaft => scene.remove(shaft));
    lightShafts = [];
    
    const lightShaftMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: params.lightShaftOpacity,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    });
    
    // 複数の光柱を作成
    for (let i = 0; i < params.numLightShafts; i++) {
        // ランダムな位置
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (aquariumSize * 0.3);
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        
        // 円錐で光柱を表現
        const height = aquariumHeight - 0.5;
        const topRadius = 0.1 + Math.random() * 0.2;
        const bottomRadius = 0.5 + Math.random() * 0.8;
        
        const geometry = new THREE.CylinderGeometry(
            topRadius, bottomRadius, height, 16, 8, true
        );
        
        const lightShaft = new THREE.Mesh(geometry, lightShaftMaterial.clone());
        lightShaft.position.set(x, aquariumHeight / 2 - 0.5, z);
        
        // 各光柱の性質を保存
        lightShaft.userData = {
            initialPos: { x, z },
            phase: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.2,
            amplitude: 0.05 + Math.random() * 0.1,
        };
        
        scene.add(lightShaft);
        lightShafts.push(lightShaft);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    water.material.uniforms['time'].value = elapsedTime;
    
    // 光柱のアニメーション部分を削除
    
    // 魚のアニメーション
    animateFishes(elapsedTime);

    controls.update();
    renderer.render(scene, camera);
}

// 魚を作成する関数
function createFishes(aquariumSize, aquariumHeight) {
    const fishColors = [
        { body: 0xff5a00, fin: 0xff8c40 },  // オレンジ＆イエロー（ゴールデンファイヤー）
        { body: 0x3a86ff, fin: 0x00f5d4 },  // 青＆水色（ブルーネオン）
        { body: 0xff006e, fin: 0x8338ec },  // ピンク＆紫（レッドフレーム）
        { body: 0xffbe0b, fin: 0xfb5607 },  // 黄色＆オレンジ（サンバースト）
        { body: 0x00bbf9, fin: 0xfee440 },  // 水色＆黄色（トロピカルダスク）
        { body: 0x9b5de5, fin: 0xf15bb5 },  // 紫＆ピンク（ミスティックグロー）
    ];
    
    // 初期の魚を削除
    fishes.forEach(fish => scene.remove(fish));
    fishes = [];
    
    // 新しい魚を追加
    for (let i = 0; i < params.fishCount; i++) {
        const colorIndex = Math.floor(Math.random() * fishColors.length);
        const { body, fin } = fishColors[colorIndex];
        
        const size = 0.6 + Math.random() * 0.4;
        
        // 水槽内のランダムな位置
        const x = (Math.random() - 0.5) * (aquariumSize - 2);
        const y = 1 + Math.random() * (aquariumHeight - 2);
        const z = (Math.random() - 0.5) * (aquariumSize - 2);
        
        const position = new THREE.Vector3(x, y, z);
        const fish = createFish(size, body, fin, position);
        
        // 魚の向きをランダムに
        fish.rotation.y = Math.random() * Math.PI * 2;
        
        scene.add(fish);
        fishes.push(fish);
    }
}

// 魚のジオメトリを作る関数
function createFishGeometry(size) {
    const bodyLength = size;
    const bodyHeight = size * 0.5;
    const bodyWidth = size * 0.25;
    
    // 魚の体
    const body = new THREE.Group();
    
    // 胴体部分 - メインボディ
    const bodyGeo = new THREE.ConeGeometry(bodyHeight * 0.5, bodyLength, 8);
    bodyGeo.rotateZ(Math.PI / 2);
    bodyGeo.translate(bodyLength * 0.25, 0, 0);
    
    // 尾びれ - 三角形のジオメトリで
    const tailGeo = new THREE.BufferGeometry();
    const tailVertices = new Float32Array([
        0, 0, 0,
        -bodyLength * 0.4, bodyHeight * 0.5, 0,
        -bodyLength * 0.4, -bodyHeight * 0.5, 0
    ]);
    tailGeo.setAttribute('position', new THREE.BufferAttribute(tailVertices, 3));
    tailGeo.computeVertexNormals();
    tailGeo.translate(-bodyLength * 0.3, 0, 0);
    
    // 側面のヒレ（左）
    const finLeftGeo = new THREE.BufferGeometry();
    const finLeftVertices = new Float32Array([
        0, 0, 0,
        bodyLength * 0.1, -bodyHeight * 0.6, 0,
        -bodyLength * 0.2, -bodyHeight * 0.6, 0
    ]);
    finLeftGeo.setAttribute('position', new THREE.BufferAttribute(finLeftVertices, 3));
    finLeftGeo.computeVertexNormals();
    finLeftGeo.translate(0, 0, bodyWidth * 0.5);
    
    // 側面のヒレ（右）
    const finRightGeo = finLeftGeo.clone();
    finRightGeo.translate(0, 0, -bodyWidth);
    
    return { bodyGeo, tailGeo, finLeftGeo, finRightGeo };
}

// 魚を生成する関数
function createFish(size, color1, color2, position) {
    const fish = new THREE.Group();
    
    // 魚のジオメトリを取得
    const { bodyGeo, tailGeo, finLeftGeo, finRightGeo } = createFishGeometry(size);
    
    // 魚の体の色を設定
    const bodyMat = new THREE.MeshPhongMaterial({
        color: color1,
        shininess: 80,
        side: THREE.DoubleSide,
        emissive: color1,
        emissiveIntensity: 0.2
    });
    
    // 魚のヒレの色を設定
    const finMat = new THREE.MeshPhongMaterial({
        color: color2,
        shininess: 80,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    
    // 魚の各パーツを作成
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const tail = new THREE.Mesh(tailGeo, finMat);
    const finLeft = new THREE.Mesh(finLeftGeo, finMat);
    const finRight = new THREE.Mesh(finRightGeo, finMat);
    
    fish.add(body, tail, finLeft, finRight);
    fish.position.copy(position);
    
    // 各魚の動きのパラメータ
    fish.userData = {
        speed: params.fishSpeed * (0.8 + Math.random() * 0.4),
        turnSpeed: 0.02 + Math.random() * 0.03,
        targetPosition: new THREE.Vector3(),
        currentTarget: new THREE.Vector3(),
        timeToNewTarget: 0,
        size: size,
        tailSpeed: 2 + Math.random() * 2,
        tailAngle: 0,
        originalY: position.y
    };
    
    return fish;
}

// ハイグロフィアの水草を生成する関数（より多様なバリエーション）
function createHygrophila(height, radius, segments, plantColor, variety = 0) {
    const plant = new THREE.Group();
    
    // 色が指定されていない場合は鮮やかな黄緑色をデフォルトに
    const leafColor = plantColor || new THREE.Color(0x7cfc00);
    const stemColor = new THREE.Color().copy(leafColor).multiplyScalar(0.7);
    
    // 茎の数 - バリエーションによって異なる
    const stemCount = Math.floor(2 + Math.random() * 3);
    
    // 葉の形のバリエーション（種類によって異なる）
    const leafShapes = [
        { width: 0.4, height: 0.15 }, // 標準
        { width: 0.6, height: 0.1 },  // 長細いタイプ
        { width: 0.25, height: 0.25 }, // 丸いタイプ
        { width: 0.5, height: 0.2 },   // 大きめタイプ
        { width: 0.35, height: 0.12 }  // 小さめタイプ
    ];
    
    // バリエーションが範囲外の場合はランダムに選択
    if (variety < 0 || variety >= leafShapes.length) {
        variety = Math.floor(Math.random() * leafShapes.length);
    }
    
    const leafShape = leafShapes[variety];
    
    for (let i = 0; i < stemCount; i++) {
        const stemGroup = new THREE.Group();
        
        // 各茎の位置をランダムに
        const angle = Math.random() * Math.PI * 2;
        const distance = radius * 0.7 * Math.random();
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        // 茎の高さをランダムに - バリエーションによって変える
        const heightVariation = variety === 1 ? 1.1 : 
                               variety === 2 ? 0.8 : 
                               variety === 3 ? 1.2 : 0.9;
        const stemHeight = height * heightVariation * (0.7 + Math.random() * 0.6);
        
        // 葉の数 - バリエーションによって異なる
        const leafDensity = variety === 0 ? 0.4 : 
                           variety === 1 ? 0.5 : 
                           variety === 2 ? 0.3 : 
                           variety === 3 ? 0.4 : 0.35;
        const leafPairs = Math.floor(stemHeight / leafDensity);
        
        // 茎の太さ - バリエーションによって異なる
        const stemThickness = variety === 1 ? 0.015 : 
                             variety === 2 ? 0.025 : 
                             variety === 3 ? 0.02 : 0.018;
        
        // 茎の作成
        const stemGeometry = new THREE.CylinderGeometry(stemThickness, stemThickness, stemHeight, 4, 1);
        const stemMaterial = new THREE.MeshStandardMaterial({
            color: stemColor,
            roughness: 0.8,
            emissive: stemColor,
            emissiveIntensity: 0.2
        });
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.set(x, stemHeight / 2, z);
        stemGroup.add(stem);
        
        // 葉の作成
        const leafGeometry = new THREE.PlaneGeometry(leafShape.width, leafShape.height);
        const leafMaterial = new THREE.MeshStandardMaterial({
            color: leafColor,
            roughness: 0.8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            emissive: leafColor,
            emissiveIntensity: 0.3
        });
        
        // 葉の配置パターン - バリエーションによって異なる
        const leafSpacing = variety === 0 ? 1.0 : // 通常の間隔
                           variety === 1 ? 1.5 : // より広い間隔
                           variety === 2 ? 0.7 : // より密な間隔
                           variety === 3 ? 1.2 : 0.9; // その他
        
        // 茎に沿って葉を配置
        for (let j = 0; j < leafPairs; j++) {
            const leafHeight = j * (stemHeight / (leafPairs * leafSpacing));
            
            // 葉の角度 - バリエーション
            const rotationMax = variety === 0 ? 0.2 : 
                               variety === 1 ? 0.3 : 
                               variety === 2 ? 0.1 : 0.25;
            
            // 左の葉
            const leafLeft = new THREE.Mesh(leafGeometry, leafMaterial);
            leafLeft.position.set(x + leafShape.width * 0.6, leafHeight, z);
            leafLeft.rotation.set(
                Math.random() * 0.1, 
                Math.random() * Math.PI * rotationMax, 
                Math.random() * Math.PI * 0.1
            );
            stemGroup.add(leafLeft);
            
            // 右の葉
            const leafRight = new THREE.Mesh(leafGeometry, leafMaterial);
            leafRight.position.set(x - leafShape.width * 0.6, leafHeight, z);
            leafRight.rotation.set(
                Math.random() * 0.1, 
                -Math.random() * Math.PI * rotationMax, 
                -Math.random() * Math.PI * 0.1
            );
            stemGroup.add(leafRight);
        }
        
        plant.add(stemGroup);
    }
    
    return plant;
}

// 別種類の水草: バリスネリア（細長い草）
function createVallisneria(height, radius, plantColor) {
    const plant = new THREE.Group();
    
    const leafColor = plantColor || new THREE.Color(0x7cfc00);
    // バリスネリアは黄緑色よりの色に
    const adjustedColor = new THREE.Color().copy(leafColor).lerp(new THREE.Color(0xaaff00), 0.3);
    
    // 茎の数
    const stemCount = Math.floor(5 + Math.random() * 7);
    
    for (let i = 0; i < stemCount; i++) {
        // 細長い葉を作成
        const leafLength = height * (0.9 + Math.random() * 0.4);
        const leafWidth = 0.05 + Math.random() * 0.03;
        
        // 葉のカーブを表現するため、複数の短い平面を連結
        const segments = 10;
        const leafSegmentLength = leafLength / segments;
        
        // 葉の開始位置
        const angle = Math.random() * Math.PI * 2;
        const distance = radius * 0.8 * Math.random();
        const startX = Math.cos(angle) * distance;
        const startZ = Math.sin(angle) * distance;
        
        // 全体のカーブ方向
        const curveDir = Math.random() * Math.PI * 2;
        const curveMagnitude = 0.1 + Math.random() * 0.2;
        
        // 葉のグループ
        const leafGroup = new THREE.Group();
        
        // セグメントごとに位置と角度を計算して葉を作成
        for (let j = 0; j < segments; j++) {
            const segmentGeometry = new THREE.PlaneGeometry(leafWidth, leafSegmentLength * 1.05); // 少し重ねる
            const segmentMaterial = new THREE.MeshStandardMaterial({
                color: adjustedColor,
                roughness: 0.7,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9,
                emissive: adjustedColor,
                emissiveIntensity: 0.2
            });
            
            const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
            
            // セグメントの位置と角度を計算
            const segmentHeight = j * leafSegmentLength;
            const heightRatio = j / segments; // 0から1の値
            
            // 曲線を描くように配置
            const curve = Math.sin(heightRatio * Math.PI) * curveMagnitude;
            const xOffset = Math.sin(curveDir) * curve * height;
            const zOffset = Math.cos(curveDir) * curve * height;
            
            segment.position.set(
                startX + xOffset,
                segmentHeight + leafSegmentLength/2,
                startZ + zOffset
            );
            
            // 葉先に向かって細くなる
            segment.scale.x = 1.0 - (heightRatio * 0.5);
            
            // 前のセグメントに合わせて回転
            if (j > 0) {
                const prevPos = leafGroup.children[j-1].position;
                const dir = new THREE.Vector3().subVectors(segment.position, prevPos).normalize();
                const up = new THREE.Vector3(0, 1, 0);
                
                // セグメント間の接続が滑らかになるよう回転
                segment.quaternion.setFromUnitVectors(up, dir);
            }
            
            leafGroup.add(segment);
        }
        
        plant.add(leafGroup);
    }
    
    return plant;
}

// 水草（全種類）を作成する関数
function createPlants(aquariumSize, plantColor) {
    // 既存の水草を削除
    plants.forEach(plant => scene.remove(plant));
    plants = [];
    
    // 色が指定されていない場合は鮮やかな黄緑色をデフォルトに
    const color = plantColor || new THREE.Color(0x7cfc00);
    
    // 密度係数を元に水草の数を計算
    // 密度2.0なら標準の2倍の水草が生成される
    const baseHygrophilaCount = 5;
    const baseWillowMossCount = 4;
    const baseVallisneriaCount = 3;
    
    // ハイグロフィアの配置
    const hygrophilaCount = Math.floor(baseHygrophilaCount * params.plantDensity);
    for (let i = 0; i < hygrophilaCount; i++) {
        const x = (Math.random() - 0.5) * (aquariumSize - 2);
        const z = (Math.random() - 0.5) * (aquariumSize - 2);
        
        const height = 2.0 + Math.random() * 1.5;
        const radius = 0.2 + Math.random() * 0.3;
        
        // 設定された種類の数までの範囲でランダム選択
        const variety = Math.floor(Math.random() * Math.min(5, params.plantVariety));
        
        const plant = createHygrophila(height, radius, 5, color, variety);
        plant.position.set(x, 0.1, z);
        
        scene.add(plant);
        plants.push(plant);
    }
    
    // バリスネリア（params.plantVarietyが2以上の場合のみ）
    if (params.plantVariety >= 2) {
        const vallisneriaCount = Math.floor(baseVallisneriaCount * params.plantDensity);
        for (let i = 0; i < vallisneriaCount; i++) {
            const x = (Math.random() - 0.5) * (aquariumSize - 2);
            const z = (Math.random() - 0.5) * (aquariumSize - 2);
            
            const height = 3.5 + Math.random() * 2.0; // より長い水草
            const radius = 0.1 + Math.random() * 0.2;
            
            const plant = createVallisneria(height, radius, color);
            plant.position.set(x, 0.1, z);
            
            scene.add(plant);
            plants.push(plant);
        }
    }
    
    // ウィローモスの配置
    const willowMossCount = Math.floor(baseWillowMossCount * params.plantDensity);
    for (let i = 0; i < willowMossCount; i++) {
        const x = (Math.random() - 0.5) * (aquariumSize - 3);
        const z = (Math.random() - 0.5) * (aquariumSize - 3);
        
        const size = 0.4 + Math.random() * 0.3;
        
        const moss = createWillowMoss(size, color);
        moss.position.set(x, 0.05, z);
        
        scene.add(moss);
        plants.push(moss);
    }
}

// ウィローモスを生成する関数
function createWillowMoss(size, mossColor) {
    const moss = new THREE.Group();
    
    // モスの粒子の数
    const particleCount = Math.floor(size * 100);
    
    // パーティクル用のジオメトリ
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    
    // ランダムな点を半球状に配置
    for (let i = 0; i < particleCount; i++) {
        // ランダムな角度と距離（半球状）
        const angle = Math.random() * Math.PI * 2;
        const radius = size * Math.random();
        const height = size * 0.2 * Math.random();
        
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = height;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
        
        // サイズのバリエーション
        scales[i] = 0.03 + Math.random() * 0.03;
        
        // 色の微妙なバリエーション
        const shade = 0.5 + Math.random() * 0.3;
        colors[i * 3] = 0.1 * shade;
        colors[i * 3 + 1] = 0.5 * shade;
        colors[i * 3 + 2] = 0.1 * shade;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // シェーダーマテリアル
    const material = new THREE.PointsMaterial({
        color: mossColor || 0x4a7834,
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8
    });
    
    const points = new THREE.Points(geometry, material);
    moss.add(points);
    
    return moss;
}

// 溶岩石を生成する関数 - よりスタイリッシュに改良
function createLavaRock(size) {
    const rock = new THREE.Group();
    
    // より自然な岩の形状
    const baseGeometry = new THREE.DodecahedronGeometry(size, 2); // より滑らかな形状
    
    // 頂点をランダムに変形 - より自然な凹凸に
    const positionAttribute = baseGeometry.getAttribute('position');
    
    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const z = positionAttribute.getZ(i);
        
        // よりランダムで自然な変形（特に上部を尖らせる）
        const distortion = 0.15; // 変形度合いを少し抑える
        const height = Math.sqrt(x * x + z * z) / size; // 中心からの距離
        const heightFactor = 1.0 - height * 0.5; // 中心ほど変形を強く
        
        const randomX = x * (1 + (Math.random() - 0.5) * distortion * heightFactor);
        const randomY = y * (1 + (Math.random() - 0.3) * distortion * heightFactor); // 上方向に少し伸ばす
        const randomZ = z * (1 + (Math.random() - 0.5) * distortion * heightFactor);
        
        positionAttribute.setXYZ(i, randomX, randomY, randomZ);
    }
    
    baseGeometry.computeVertexNormals();
    
    // マテリアル - より自然な表面質感
    const material = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true,
        // 紫色の光を受けやすく
        emissive: 0x120012, // わずかな紫の自己発光
        emissiveIntensity: 0.05
    });
    
    const baseMesh = new THREE.Mesh(baseGeometry, material);
    rock.add(baseMesh);
    
    // 少数の特徴的な突起だけを追加（多すぎない）
    const bumpCount = Math.floor(3 + Math.random() * 3); // より少なく
    
    for (let i = 0; i < bumpCount; i++) {
        // より大きく、特徴的な突起
        const bumpSize = size * (0.2 + Math.random() * 0.25);
        const bumpGeometry = new THREE.DodecahedronGeometry(bumpSize, 1);
        
        // 底面に近い部分（Y座標がマイナス側）に突起を集中
        const angle1 = Math.random() * Math.PI * 2;
        const angle2 = Math.random() * Math.PI * 0.3 + Math.PI * 0.5; // 下半分にのみ配置
        const radius = size * 0.85;
        
        const x = Math.sin(angle2) * Math.cos(angle1) * radius;
        const y = -Math.cos(angle2) * radius * 0.7; // 下側に押し下げる
        const z = Math.sin(angle2) * Math.sin(angle1) * radius;
        
        // 突起も歪ませる
        const bumpPositionAttr = bumpGeometry.getAttribute('position');
        for (let j = 0; j < bumpPositionAttr.count; j++) {
            const bx = bumpPositionAttr.getX(j);
            const by = bumpPositionAttr.getY(j);
            const bz = bumpPositionAttr.getZ(j);
            
            const bumpDistortion = 0.1;
            bumpPositionAttr.setXYZ(j,
                bx * (1 + (Math.random() - 0.5) * bumpDistortion),
                by * (1 + (Math.random() - 0.3) * bumpDistortion),
                bz * (1 + (Math.random() - 0.5) * bumpDistortion)
            );
        }
        bumpGeometry.computeVertexNormals();
        
        const bump = new THREE.Mesh(bumpGeometry, material);
        bump.position.set(x, y, z);
        
        // 回転をランダムに設定
        bump.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        
        rock.add(bump);
    }
    
    return rock;
}

// 魚のアニメーション
function animateFishes(time) {
    // 水槽の制限範囲
    const tankLimit = 9.0;
    const tankHeight = 7.0;
    
    fishes.forEach(fish => {
        const { speed, turnSpeed, targetPosition, currentTarget, timeToNewTarget, tailSpeed, originalY } = fish.userData;
        
        // 尾びれの動きをアニメーション
        fish.userData.tailAngle = Math.sin(time * tailSpeed) * 0.2;
        
        // 尾びれを動かす
        if (fish.children[1]) {
            fish.children[1].rotation.y = fish.userData.tailAngle;
        }
        
        // ランダムな時間ごとに新しい目標地点を設定
        if (time > fish.userData.timeToNewTarget) {
            // 水槽内のランダムな位置を目標に
            targetPosition.set(
                (Math.random() - 0.5) * tankLimit * 2,
                originalY + (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * tankLimit * 2
            );
            
            // 水槽の境界内に制限
            targetPosition.x = Math.max(-tankLimit, Math.min(tankLimit, targetPosition.x));
            targetPosition.y = Math.max(1, Math.min(tankHeight, targetPosition.y));
            targetPosition.z = Math.max(-tankLimit, Math.min(tankLimit, targetPosition.z));
            
            // 次の目標変更までの時間
            fish.userData.timeToNewTarget = time + 3 + Math.random() * 5;
            
            // 現在の目標位置を更新
            currentTarget.copy(targetPosition);
        }
        
        // 目標までの方向ベクトル
        const direction = new THREE.Vector3().subVectors(currentTarget, fish.position);
        
        // 距離がある場合、魚を回転させて目標の方向を向かせる
        if (direction.length() > 0.2) {
            // 現在の方向ベクトル（魚の前方）
            const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(fish.quaternion);
            
            // 目標方向への回転を計算
            const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(1, 0, 0),
                direction.clone().normalize()
            );
            
            // 滑らかに回転
            fish.quaternion.slerp(targetQuaternion, turnSpeed);
            
            // 魚を前進させる
            const velocity = forward.clone().multiplyScalar(speed * 0.05);
            fish.position.add(velocity);
        }
    });
}

// 水草（ハイグロフィア）を作成する関数
function createPlants(aquariumSize, plantColor) {
    // 既存の水草を削除
    plants.forEach(plant => scene.remove(plant));
    plants = [];
    
    // 色が指定されていない場合は鮮やかな黄緑色をデフォルトに
    const color = plantColor || new THREE.Color(0x7cfc00);
    
    // 密度係数を元に水草の数を計算
    // 密度2.0なら標準の2倍の水草が生成される
    const baseHygrophilaCount = 5;
    const baseWillowMossCount = 4;
    const baseVallisneriaCount = 3;
    
    // ハイグロフィアの配置
    const hygrophilaCount = Math.floor(baseHygrophilaCount * params.plantDensity);
    for (let i = 0; i < hygrophilaCount; i++) {
        const x = (Math.random() - 0.5) * (aquariumSize - 2);
        const z = (Math.random() - 0.5) * (aquariumSize - 2);
        
        const height = 2.0 + Math.random() * 1.5;
        const radius = 0.2 + Math.random() * 0.3;
        
        // 設定された種類の数までの範囲でランダム選択
        const variety = Math.floor(Math.random() * Math.min(5, params.plantVariety));
        
        const plant = createHygrophila(height, radius, 5, color, variety);
        plant.position.set(x, 0.1, z);
        
        scene.add(plant);
        plants.push(plant);
    }
    
    // バリスネリア（params.plantVarietyが2以上の場合のみ）
    if (params.plantVariety >= 2) {
        const vallisneriaCount = Math.floor(baseVallisneriaCount * params.plantDensity);
        for (let i = 0; i < vallisneriaCount; i++) {
            const x = (Math.random() - 0.5) * (aquariumSize - 2);
            const z = (Math.random() - 0.5) * (aquariumSize - 2);
            
            const height = 3.5 + Math.random() * 2.0; // より長い水草
            const radius = 0.1 + Math.random() * 0.2;
            
            const plant = createVallisneria(height, radius, color);
            plant.position.set(x, 0.1, z);
            
            scene.add(plant);
            plants.push(plant);
        }
    }
    
    // ウィローモスの配置
    const willowMossCount = Math.floor(baseWillowMossCount * params.plantDensity);
    for (let i = 0; i < willowMossCount; i++) {
        const x = (Math.random() - 0.5) * (aquariumSize - 3);
        const z = (Math.random() - 0.5) * (aquariumSize - 3);
        
        const size = 0.4 + Math.random() * 0.3;
        
        const moss = createWillowMoss(size, color);
        moss.position.set(x, 0.05, z);
        
        scene.add(moss);
        plants.push(moss);
    }
}

// 魚の数を更新する関数
function updateFishCount(count, aquariumSize, aquariumHeight) {
    if (count < fishes.length) {
        // 魚を減らす
        while (fishes.length > count) {
            const fish = fishes.pop();
            scene.remove(fish);
        }
    } else if (count > fishes.length) {
        // 魚を増やす
        const fishColors = [
            { body: 0xff5a00, fin: 0xff8c40 },
            { body: 0x3a86ff, fin: 0x00f5d4 },
            { body: 0xff006e, fin: 0x8338ec },
            { body: 0xffbe0b, fin: 0xfb5607 },
            { body: 0x00bbf9, fin: 0xfee440 },
            { body: 0x9b5de5, fin: 0xf15bb5 },
        ];
        
        while (fishes.length < count) {
            const colorIndex = Math.floor(Math.random() * fishColors.length);
            const { body, fin } = fishColors[colorIndex];
            
            const size = 0.6 + Math.random() * 0.4;
            
            // 水槽内のランダムな位置
            const x = (Math.random() - 0.5) * (aquariumSize - 2);
            const y = 1 + Math.random() * (aquariumHeight - 2);
            const z = (Math.random() - 0.5) * (aquariumSize - 2);
            
            const position = new THREE.Vector3(x, y, z);
            const fish = createFish(size, body, fin, position);
            
            // 魚の向きをランダムに
            fish.rotation.y = Math.random() * Math.PI * 2;
            
            scene.add(fish);
            fishes.push(fish);
        }
    }
}

try {
    init();
} catch (error) {
    console.error("Failed to initialize Three.js scene:", error);
    const errorElement = document.createElement('div');
    errorElement.style.color = 'red';
    errorElement.style.position = 'absolute';
    errorElement.style.top = '10px';
    errorElement.style.left = '10px';
    errorElement.style.fontFamily = 'monospace';
    errorElement.textContent = 'Error initializing the 3D scene. Check console for more details.';
    document.body.appendChild(errorElement);
}
