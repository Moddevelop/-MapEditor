/*
============================================================
 BBRACING MAP EDITOR
 main.js

 ESTA VERSIÓN:
 -----------------------------------------------------------
 - Carga BeachB.bin.json
 - Busca VuAiWaypointEntity
 - Recorre ChildEntities recursivamente
 - Lee VuTransformComponent
 - Lee Position
 - Lee Rotation
 - Lee Scale
 - Muestra los waypoints en 3D
 - Muestra el nombre encima del waypoint
 - Permite seleccionarlos
 - Permite moverlos
 - Permite rotarlos
 - Permite escalarlos
 - Inspector con valores reales
 - Guarda una representación editable de los waypoints

 TODAVÍA NO:
 -----------------------------------------------------------
 - Carga modelos GLB automáticamente desde AssetData
 - Modifica materiales
 - Modifica texturas
 - Reconstruye completamente BeachB.bin.json

 Eso lo hacemos después.
============================================================
*/

import * as THREE from "three";

import {
    OrbitControls
} from "three/addons/controls/OrbitControls.js";

import {
    TransformControls
} from "three/addons/controls/TransformControls.js";

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";



// ============================================================
// VARIABLES PRINCIPALES
// ============================================================

let scene;
let camera;
let renderer;
let world;
let outOfBoundsGroup;

let orbit;
let transformControls;

let raycaster;
let mouse;

let grid;
let axes;

let selected = null;

let objects = [];

let mapData = null;

// Copiar/Pegar: a qué array (ChildEntities) pertenece cada entidad
// dentro de mapData, y qué hay copiado en el "portapapeles".
let entidadAContenedor = new WeakMap();
let clipboard = null;
let pegadoCounter = 0;

let waypointCounter = 0;

//glb and gltf
const gltfLoader = new GLTFLoader();


// ============================================================
// HTML
// ============================================================

const viewport =
    document.getElementById("viewport");

const objectList =
    document.getElementById("objectList");

const mapStatus =
    document.getElementById("mapStatus");

const noSelection =
    document.getElementById("noSelection");

const objectInspector =
    document.getElementById("objectInspector");

// ============================================================
// INICIALIZACIÓN
// ============================================================

function init() {

    // --------------------------------------------------------
    // ESCENA
    // --------------------------------------------------------

    scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(0x151515);


    // --------------------------------------------------------
    // CÁMARA
    // --------------------------------------------------------

    camera =
        new THREE.PerspectiveCamera(
            60,
            window.innerWidth /
            window.innerHeight,
            0.1,
            100000
        );

    camera.position.set(
        30,
        25,
        30
    );


    // --------------------------------------------------------
    // RENDERER
    // --------------------------------------------------------

    renderer =
        new THREE.WebGLRenderer({
            antialias: true
        });

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            2
        )
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    viewport.appendChild(
        renderer.domElement
    );


    // --------------------------------------------------------
    // CÁMARA / ORBIT
    // --------------------------------------------------------

    orbit =
        new OrbitControls(
            camera,
            renderer.domElement
        );

    orbit.enableDamping = true;

    orbit.dampingFactor = 0.08;

    orbit.target.set(
        0,
        0,
        0
    );


    // --------------------------------------------------------
    // LUCES
    // --------------------------------------------------------

    const ambient =
        new THREE.HemisphereLight(
            0xffffff,
            0x444444,
            2
        );

    scene.add(
        ambient
    );


    const directional =
        new THREE.DirectionalLight(
            0xffffff,
            2
        );

    directional.position.set(
        100,
        200,
        100
    );

    scene.add(
        directional
    );


    // --------------------------------------------------------
    // GRID
    // --------------------------------------------------------

    grid =
        new THREE.GridHelper(
            500,
            100
        );

    scene.add(
        grid
    );


    // --------------------------------------------------------
    // EJES
    // --------------------------------------------------------

    axes =
        new THREE.AxesHelper(
            20
        );

    scene.add(
        axes
    );


    // --------------------------------------------------------
    // RAYCASTER
    // --------------------------------------------------------

    raycaster =
        new THREE.Raycaster();

    mouse =
        new THREE.Vector2();


    // --------------------------------------------------------
    // TRANSFORM CONTROLS
    // --------------------------------------------------------

    transformControls =
        new TransformControls(
            camera,
            renderer.domElement
        );

    transformControls.setMode(
        "translate"
    );

    transformControls.setSize(
        0.8
    );


    transformControls.addEventListener(
        "dragging-changed",
        event => {

            orbit.enabled =
                !event.value;

        }
    );


    transformControls.addEventListener(
        "objectChange",
        () => {

            updateInspector();

        }
    );


    scene.add(
        transformControls.getHelper()
    );


    //----------------------------------------------------------
    // World
    //----------------------------------------------------------
    
    world = new THREE.Group();
    world.name = "BBRacingWorld";
    
    scene.add(world);

    //position
    world.position.x = 0.0;
    world.position.y = 7.0;
    world.position.z = 0.0;
    
    // Rotación global del mapa

    world.rotation.x = THREE.MathUtils.degToRad(270); //90


    // Grupo aparte para las cajas "Out Of Bounds" (invisibles en
    // el juego, solo ayuda visual del editor). Va DENTRO de world
    // para heredar la misma rotación/posición que todo lo demás.
    outOfBoundsGroup = new THREE.Group();
    outOfBoundsGroup.name = "OutOfBoundsHelpers";
    outOfBoundsGroup.visible = false; // oculto por defecto
    world.add(outOfBoundsGroup);
    
    
    
    // --------------------------------------------------------
    // EVENTOS
    // --------------------------------------------------------

    renderer.domElement.addEventListener(
        "pointerdown",
        onPointerDown
    );


    window.addEventListener(
        "resize",
        onResize
    );


    // --------------------------------------------------------
    // ABRIR JSON
    // --------------------------------------------------------

    document
        .getElementById("openMap")
        .onclick =
            () => {

                document
                    .getElementById("mapFile")
                    .click();

            };


    document
        .getElementById("mapFile")
        .addEventListener(
            "change",
            loadJSON
        );


    // --------------------------------------------------------
    // --------------------------------------------------------
    // COPIAR / PEGAR
    // --------------------------------------------------------

    document
        .getElementById("copyObject")
        .onclick =
            copiarSeleccionado;

    document
        .getElementById("pasteObject")
        .onclick =
            pegarClipboard;


    // --------------------------------------------------------
    // BORRAR
    // --------------------------------------------------------

    document
        .getElementById("deleteObject")
        .onclick =
            deleteSelected;


    // --------------------------------------------------------
    // GUARDAR
    // --------------------------------------------------------

    document
        .getElementById("saveMap")
        .onclick =
            saveMap;


    // --------------------------------------------------------
    // GRID
    // --------------------------------------------------------

    document
        .getElementById("toggleGrid")
        .onclick =
            () => {

                grid.visible =
                    !grid.visible;

                document
                    .getElementById("toggleGrid")
                    .classList.toggle("active", grid.visible);

            };


    // --------------------------------------------------------
    // VISIBILIDAD: MAPA / LÍMITES (out of bounds)
    // --------------------------------------------------------

    document
        .getElementById("toggleWorldVis")
        .onclick =
            (e) => {

                world.visible = !world.visible;
                e.currentTarget.classList.toggle("active", world.visible);

            };

    document
        .getElementById("toggleOOBVis")
        .onclick =
            (e) => {

                outOfBoundsGroup.visible = !outOfBoundsGroup.visible;
                e.currentTarget.classList.toggle("active", outOfBoundsGroup.visible);

            };


    // --------------------------------------------------------
    // INSPECTOR
    // --------------------------------------------------------

    document
        .getElementById("applyTransform")
        .onclick =
            applyInspector;


    document
        .getElementById("focusObject")
        .onclick =
            focusSelected;


    // --------------------------------------------------------
    // TECLADO
    // --------------------------------------------------------

    window.addEventListener(
        "keydown",
        onKeyDown
    );


    // --------------------------------------------------------
    // INICIAR
    // --------------------------------------------------------

    animate();
}


// ============================================================
// LOOP
// ============================================================

function animate() {

    requestAnimationFrame(
        animate
    );

    orbit.update();

    renderer.render(
        scene,
        camera
    );
}


// ============================================================
// RESIZE
// ============================================================

function onResize() {

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}


// ============================================================
// CLIC / TOUCH
// ============================================================

function onPointerDown(event) {

    if (
        transformControls.dragging
    ) {

        return;

    }


    const rect =
        renderer.domElement
            .getBoundingClientRect();


    mouse.x =
        (
            event.clientX -
            rect.left
        ) /
        rect.width *
        2 -
        1;


    mouse.y =
        -(
            (
                event.clientY -
                rect.top
            ) /
            rect.height
        ) *
        2 +
        1;


    raycaster.setFromCamera(
        mouse,
        camera
    );


    const hits =
        raycaster.intersectObjects(
            objects,
            true
        );


    if (!hits.length) {

        selectObject(
            null
        );

        return;

    }


    let object =
        hits[0].object;


    while (
        object.parent &&
        !objects.includes(
            object
        )
    ) {

        object =
            object.parent;

    }


    if (
        objects.includes(
            object
        )
    ) {

        selectObject(
            object
        );

    }

}


// ============================================================
// SELECCIONAR
// ============================================================

function selectObject(object) {

    selected =
        object;


    if (selected) {

        transformControls.attach(
            selected
        );

    }
    else {

        transformControls.detach();

    }


    updateInspector();

    updateObjectList();

}


// ============================================================
// CREAR WAYPOINT
// ============================================================

function addWaypoint() {

    waypointCounter++;


    const waypoint =
        createWaypointMarker(
            `Waypoint_${waypointCounter}`
        );


    waypoint.position.set(
        0,
        1,
        0
    );


    waypoint.userData.type =
        "VuAiWaypointEntity";


    waypoint.userData.name =
        `Waypoint_${waypointCounter}`;


    waypoint.userData.source =
        null;


    world.add(waypoint);


    objects.push(
        waypoint
    );


    selectObject(
        waypoint
    );


    updateObjectList();

}


// ============================================================
// CREAR MARCADOR
// ============================================================

function createWaypointMarker(
    name
) {

    const group =
        new THREE.Group();


    group.name =
        name;


    const sphere =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                0.8,
                20,
                12
            ),

            new THREE.MeshStandardMaterial({

                color:
                    0xff3333,

                emissive:
                    0x550000,

                roughness:
                    0.6

            })

        );


    sphere.userData.isWaypointPart =
        true;


    group.add(
        sphere
    );


    const cone =
        new THREE.Mesh(

            new THREE.ConeGeometry(
                0.35,
                1.2,
                12
            ),

            new THREE.MeshStandardMaterial({

                color:
                    0xffcc00,

                emissive:
                    0x442200

            })

        );


    cone.position.y =
        -0.9;


    cone.userData.isWaypointPart =
        true;


    group.add(
        cone
    );


    const lineGeometry =
        new THREE.BufferGeometry()
            .setFromPoints([

                new THREE.Vector3(
                    0,
                    -0.3,
                    0
                ),

                new THREE.Vector3(
                    0,
                    -4,
                    0
                )

            ]);


    const line =
        new THREE.Line(

            lineGeometry,

            new THREE.LineBasicMaterial({
                color: 0xff3333
            })

        );


    line.userData.isWaypointPart =
        true;


    group.add(
        line
    );


    const label =
        createLabel(
            name
        );


    label.position.set(
        0,
        1.5,
        0
    );


    group.add(
        label
    );


    return group;

}


// ============================================================
// CREAR TEXTO
// ============================================================

function createLabel(text) {

    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        512;

    canvas.height =
        128;


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "rgba(0,0,0,0.75)";


    ctx.fillRect(
        0,
        20,
        canvas.width,
        88
    );


    ctx.font =
        "bold 42px Arial";


    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";


    ctx.fillStyle =
        "#ffffff";


    ctx.fillText(
        text,
        canvas.width / 2,
        canvas.height / 2
    );


    const texture =
        new THREE.CanvasTexture(
            canvas
        );


    texture.colorSpace =
        THREE.SRGBColorSpace;


    const material =
        new THREE.SpriteMaterial({

            map:
                texture,

            transparent:
                true,

            depthTest:
                false

        });


    const sprite =
        new THREE.Sprite(
            material
        );


    sprite.scale.set(
        5,
        1.25,
        1
    );


    sprite.userData.isWaypointPart =
        true;


    return sprite;

}


// ============================================================
// CARGAR JSON
// ============================================================

async function loadJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        mapData = JSON.parse(await file.text());
        clearObjects(); waypointCounter = 0;
        entidadAContenedor = new WeakMap();
        clipboard = null;
        indexarContenedores(mapData);

        // 1. Cargar todos los objetos/pistas
        const entidades = buscarTodasLasEntidades(mapData);
        console.log(`📦 Encontrados ${entidades.length} objetos`);

        let cargados = 0;
        let fallidos = 0;

        for (const ent of entidades) {
            if (ent.type === "VuAiWaypointEntity") {
                createWaypointFromEntity(ent);
                continue;
            }

            if (ent.type === "VuOutOfBoundsBoxEntity") {
                const caja = crearCajaOutOfBounds(ent);
                outOfBoundsGroup.add(caja);
                continue;
            }

            const modelName = getModelName(ent);

            if (modelName) {
                const ok = await crearObjetoDesdeEntidad(ent, modelName);
                if (ok) cargados++; else fallidos++;
            }
        }

        console.log(`✅ Modelos cargados: ${cargados} | ❌ Fallidos: ${fallidos}`);

        updateObjectList();
        mapStatus.textContent = `${file.name} - Cargado completo`;
        focusAll();
    } catch(err) { alert("Error: " + err.message); }
}

// Función auxiliar para encontrar todas las entidades
function buscarTodasLasEntidades(datos) {
    const lista = [];
    function recorrer(val) {
        if (!val || typeof val !== "object") return;
        if (!Array.isArray(val)) {
            if (val.type) lista.push(val);
            Object.values(val).forEach(recorrer);
        } else val.forEach(recorrer);
    }
    recorrer(datos);
    return lista;
}

// ============================================================
// ÍNDICE DE CONTENEDORES (para poder Copiar/Pegar de verdad)
// ============================================================
// Recorre el árbol y recuerda, para cada entidad, el ARRAY exacto
// (normalmente un "ChildEntities") que la contiene. Así, al pegar
// una copia, la insertamos en el mismo lugar del árbol que el
// original -- y sí queda dentro del mapData real al Guardar.
function indexarContenedores(valor) {
    if (Array.isArray(valor)) {
        for (const item of valor) {
            if (item && typeof item === "object" && item.type) {
                entidadAContenedor.set(item, valor);
            }
            indexarContenedores(item);
        }
    } else if (valor && typeof valor === "object") {
        for (const val of Object.values(valor)) {
            indexarContenedores(val);
        }
    }
}

function clonarEntidad(entidad) {
    // Clonado profundo, sin compartir referencias con el original
    return JSON.parse(JSON.stringify(entidad));
}

// ============================================================
// BUSCAR WAYPOINTS RECURSIVAMENTE
// ============================================================

function findWaypoints(
    root
) {

    const result = [];


    function walk(
        value
    ) {

        if (
            !value ||
            typeof value !== "object"
        ) {

            return;

        }


        if (
            !Array.isArray(
                value
            )
        ) {

            if (
                value.type ===
                "VuAiWaypointEntity"
            ) {

                result.push(
                    value
                );

            }


            for (
                const key
                of Object.keys(value)
            ) {

                walk(
                    value[key]
                );

            }

        }
        else {

            for (
                const item
                of value
            ) {

                walk(
                    item
                );

            }

        }

    }


    walk(
        root
    );


    return result;

}


// ============================================================
// CREAR WAYPOINT DESDE ENTIDAD REAL
// ============================================================

function createWaypointFromEntity(
    entity
) {

    const name =
        entity.name ||
        "Waypoint";


    waypointCounter++;


    const waypoint =
        createWaypointMarker(
            name
        );


    waypoint.userData.type =
        "VuAiWaypointEntity";


    waypoint.userData.name =
        name;


    waypoint.userData.source =
        entity;


    const transform =
        getTransformComponent(
            entity
        );


    if (transform) {

        const properties =
            transform.Properties ||
            transform.properties ||
            {};


        const position =
            readVector(
                properties.Position
            );


        waypoint.position.copy(
            position
        );


        const rotation =
            readVector(
                properties.Rotation
            );


        waypoint.rotation.set(

            THREE.MathUtils.degToRad(
                rotation.x
            ),

            THREE.MathUtils.degToRad(
                rotation.y
            ),

            THREE.MathUtils.degToRad(
                rotation.z
            )

        );


        const scale =
            readVector(
                //properties.Scale
                         3.0,
                new THREE.Vector3(
                    1,
                    1,
                    1
                )
            );


        waypoint.scale.copy(
            scale
        );

    }


    world.add(waypoint);


    objects.push(
        waypoint
    );

    return waypoint;

}


// ============================================================
// ENCONTRAR TRANSFORM
// ============================================================

function getTransformComponent(
    entity
) {

    const data =
        entity.data;


    if (!data)
        return null;


    const components =
        data.Components ||
        data.components;


    if (!components)
        return null;


    return (
        components.VuTransformComponent ||
        components.vuTransformComponent ||
        null
    );

}

// ============================================================
// Cargar modelos gltf
// ============================================================

//pop up

document.getElementById("popup").classList.add("mostrar");
let infotxt = document.getElementById("fuckyou");

// Se quita solo después de unos segundos
setTimeout(() => {
    document.getElementById("popup").classList.remove("mostrar");
}, 2000);




const root = "model/"; //carpeta de modelos3D || reositiories of models
const file = ".glb"; //extension de archivos || extention files
const Models = new Map();  // Guarda modelos ya cargados || save models

// ============================================================
// ÍNDICE DE MODELOS REALES (por nombre de archivo)
// ============================================================
// El "type" de una entidad (ej. "#Tile/Shore/Shore_CurveOutA") es
// una referencia a un TEMPLATE, y la carpeta del template no
// siempre coincide con la carpeta real del modelo estático
// (ej. el modelo real vive en "Env/Shore/Shore_CurveOutA").
//
// Este índice usa la lista VuStaticModelAsset que ya viene dentro
// del propio JSON del mapa para poder encontrar el modelo real
// buscando solo por el nombre de archivo (última parte de la ruta),
// sin importar en qué carpeta esté.
let assetIndexPorNombre = null;

function buildAssetIndex(mapData) {
    const index = new Map(); // nombreArchivo -> rutaCompleta

    const assetData = mapData?.AssetData;
    if (!Array.isArray(assetData)) return index;

    for (const group of assetData) {
        if (!Array.isArray(group) || group[0] !== "VuStaticModelAsset") continue;
        for (const rutaCompleta of group.slice(1)) {
            const nombreArchivo = rutaCompleta.split("/").pop();
            // Si hay varias coincidencias con el mismo nombre, nos
            // quedamos con la primera (caso poco común).
            if (!index.has(nombreArchivo)) {
                index.set(nombreArchivo, rutaCompleta);
            }
        }
    }
    return index;
}

async function intentarCargarGLB(rutaModelo) {
    const succes = `${root}${rutaModelo}${file}`;
    infotxt.textContent = `loading: ${succes}`;
    const gltf = await gltfLoader.loadAsync(succes);
    return gltf.scene;
}

// ============================================================
// BÚSQUEDA POR SIMILITUD (para props "rompibles" tipo Building)
// ============================================================
// "#Building/BuildingBreakable_HutA" no coincide ni en carpeta NI
// en nombre de archivo con el modelo real "Building/Hut_A". Estos
// son props rompibles: el template compone una versión intacta
// (Hut_A) y una rota (Hut_A_broken). Buscamos por coincidencia
// parcial de texto y preferimos la versión intacta.
let listaModelosEstaticos = null;

function buildAssetList(mapData) {
    const lista = [];
    const assetData = mapData?.AssetData;
    if (!Array.isArray(assetData)) return lista;
    for (const group of assetData) {
        if (!Array.isArray(group) || group[0] !== "VuStaticModelAsset") continue;
        for (const ruta of group.slice(1)) lista.push(ruta);
    }
    return lista;
}

function normalizarNombre(rutaOTexto) {
    const nombre = rutaOTexto.split("/").pop();
    return nombre
        .replace(/breakable/gi, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
}

function buscarModeloPorSimilitud(referencia) {
    if (!listaModelosEstaticos) {
        listaModelosEstaticos = buildAssetList(mapData);
    }

    const objetivo = normalizarNombre(referencia);
    if (!objetivo) return null;

    const candidatos = listaModelosEstaticos.filter(ruta => {
        const n = normalizarNombre(ruta);
        return n && (objetivo.includes(n) || n.includes(objetivo));
    });

    if (candidatos.length === 0) return null;

    // Preferimos la versión "limpia": sin _broken, _col, _lod, _ref
    const limpios = candidatos.filter(r => !/_(broken|col|lod\d*|ref)$/i.test(r));
    const pool = limpios.length ? limpios : candidatos;

    // Entre los candidatos, el nombre más corto suele ser la versión base
    return pool.sort((a, b) => a.length - b.length)[0];
}

// ============================================================
// TEXTURAS
// ============================================================
// Cada malla dentro del .glb ya trae el nombre real del material
// del juego en mesh.material.name (ej. "Env/Rocks/Rocks_LargeA").
// El juego amarra imagen <-> material por convención de nombre
// (mismo nombre base, ej. material "Env/Shore/Cliff" -> imagen
// "Env/Shore/Cliff.png"), así que buscamos la imagen igual que
// buscamos los modelos: directo -> nombre exacto -> similitud.
const textureRoot = "texture/";
const textureFile = ".png";
const textureLoader = new THREE.TextureLoader();
const Texturas = new Map(); // nombreMaterial -> THREE.Texture

let listaTexturas = null;
let indiceTexturasPorNombre = null;

function buildTextureList(mapData) {
    const lista = [];
    const assetData = mapData?.AssetData;
    if (!Array.isArray(assetData)) return lista;
    for (const group of assetData) {
        if (!Array.isArray(group) || group[0] !== "VuTextureAsset") continue;
        for (const ruta of group.slice(1)) lista.push(ruta);
    }
    return lista;
}

function buildTextureIndex(mapData) {
    const index = new Map();
    for (const ruta of buildTextureList(mapData)) {
        const nombreArchivo = ruta.split("/").pop();
        if (!index.has(nombreArchivo)) index.set(nombreArchivo, ruta);
    }
    return index;
}

async function intentarCargarTextura(rutaTextura) {
    const succes = `${textureRoot}${rutaTextura}${textureFile}`;
    const tex = await textureLoader.loadAsync(succes);
    tex.colorSpace = THREE.SRGBColorSpace;

    // Las texturas de glTF usan origen arriba-izquierda; el
    // TextureLoader normal de three.js voltea verticalmente por
    // defecto (flipY=true), lo que se ve como la imagen invertida
    // o mal alineada sobre el modelo. La desactivamos.
    tex.flipY = false;

    return tex;
}

function buscarTexturaPorSimilitud(referencia) {
    if (!listaTexturas) listaTexturas = buildTextureList(mapData);

    const objetivo = normalizarNombre(referencia);
    if (!objetivo) return null;

    const candidatos = listaTexturas.filter(ruta => {
        const n = normalizarNombre(ruta);
        return n && (objetivo.includes(n) || n.includes(objetivo));
    });

    if (candidatos.length === 0) return null;
    return candidatos.sort((a, b) => a.length - b.length)[0];
}

async function chargeTexture(nombreMaterial) {
    if (!nombreMaterial) return null;
    if (Texturas.has(nombreMaterial)) return Texturas.get(nombreMaterial);

    // Intento 1: nombre directo del material
    try {
        const tex = await intentarCargarTextura(nombreMaterial);
        Texturas.set(nombreMaterial, tex);
        return tex;
    } catch (err) {
        // Intento 2: mismo nombre de archivo, distinta carpeta
        if (!indiceTexturasPorNombre) {
            indiceTexturasPorNombre = buildTextureIndex(mapData);
        }
        const nombreArchivo = nombreMaterial.split("/").pop();
        const rutaExacta = indiceTexturasPorNombre.get(nombreArchivo);

        if (rutaExacta && rutaExacta !== nombreMaterial) {
            try {
                const tex = await intentarCargarTextura(rutaExacta);
                console.log(`🎨 "${nombreMaterial}" resuelto (exacto) como "${rutaExacta}"`);
                Texturas.set(nombreMaterial, tex);
                return tex;
            } catch (err2) { /* seguimos */ }
        }

        // Intento 3: similitud de texto
        const rutaSimilar = buscarTexturaPorSimilitud(nombreMaterial);
        if (rutaSimilar && rutaSimilar !== rutaExacta) {
            try {
                const tex = await intentarCargarTextura(rutaSimilar);
                console.log(`🎨 "${nombreMaterial}" resuelto (similitud) como "${rutaSimilar}"`);
                Texturas.set(nombreMaterial, tex);
                return tex;
            } catch (err3) { /* sin suerte */ }
        }

        console.warn(`No se encontró textura para el material "${nombreMaterial}"`);
        Texturas.set(nombreMaterial, null); // no reintentar de nuevo
        return null;
    }
}

// Recorre todas las mallas del modelo recién cargado y les aplica
// su textura según el nombre del material que ya trae el .glb.
async function aplicarTexturas(scene) {
    const mallas = [];
    scene.traverse(obj => {
        if (obj.isMesh && obj.material) mallas.push(obj);
    });

    for (const malla of mallas) {
        const materiales = Array.isArray(malla.material) ? malla.material : [malla.material];

        for (const mat of materiales) {
            if (!mat || !mat.name) continue;

            const tex = await chargeTexture(mat.name);
            if (tex) {
                mat.map = tex;
                mat.needsUpdate = true;
            }
        }
    }
}

async function chargeModel(VuEngine){
    // si el modelo cargo antes -> devolvemos copia
    if(Models.has(VuEngine)){
        return Models.get(VuEngine).clone(true);
    }

    // Intento 1: ruta directa tal como viene de la entidad
    try{
        const scene = await intentarCargarGLB(VuEngine);
        await aplicarTexturas(scene);
        Models.set(VuEngine, scene);
        return scene.clone(true);
    }catch (err){
        // Intento 2: mismo nombre de archivo, distinta carpeta
        if (!assetIndexPorNombre) {
            assetIndexPorNombre = buildAssetIndex(mapData);
        }

        const nombreArchivo = VuEngine.split("/").pop();
        const rutaExacta = assetIndexPorNombre.get(nombreArchivo);

        if (rutaExacta && rutaExacta !== VuEngine) {
            try {
                const scene = await intentarCargarGLB(rutaExacta);
                console.log(`↻ "${VuEngine}" resuelto (exacto) como "${rutaExacta}"`);
                await aplicarTexturas(scene);
                Models.set(VuEngine, scene);
                return scene.clone(true);
            } catch (err2) { /* seguimos al intento 3 */ }
        }

        // Intento 3: búsqueda por similitud (props rompibles, etc.)
        const rutaSimilar = buscarModeloPorSimilitud(VuEngine);
        if (rutaSimilar && rutaSimilar !== rutaExacta) {
            try {
                const scene = await intentarCargarGLB(rutaSimilar);
                console.log(`↻ "${VuEngine}" resuelto (similitud) como "${rutaSimilar}"`);
                await aplicarTexturas(scene);
                Models.set(VuEngine, scene);
                return scene.clone(true);
            } catch (err3) {
                console.warn(`No se pudo cargar "${VuEngine}" ni su candidato "${rutaSimilar}":`, err3.message);
                return null;
            }
        }

        console.warn(`No se pudo cargar el modelo "${VuEngine}" (${root}${VuEngine}${file}) — sin coincidencias`);
        return null;
    }
} 

/*
//cargar un modelo 3d
gltfLoader.load('model/Boat.glb', function(glb){
    scene.add(glb.scene);
    
}, undefined, function ( error ) { //if the model does exit

    alert("error: g12b");
    	console.error('im sorry');

});*/

// ============================================================
// crear modelos,codigo geberado con IA
// 
// ============================================================

// ============================================================
// ZONAS "OUT OF BOUNDS" (cajas invisibles en el juego)
// ============================================================
// VuOutOfBoundsBoxEntity trae un VuTransformComponent normal
// (Position/Rotation/Scale), igual que los demás -- no hay Min/Max
// aparte. Dibujamos un cubo unitario (1x1x1) en wireframe y dejamos
// que la Scale de la entidad le dé el tamaño real de la caja.
function crearCajaOutOfBounds(entidad) {

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const wireframe = new THREE.WireframeGeometry(geometry);

    const caja = new THREE.LineSegments(
        wireframe,
        new THREE.LineBasicMaterial({ color: 0xff3333 })
    );

    const transform = getTransformComponent(entidad);
    const properties = transform?.Properties || transform?.properties || {};

    const pos = readVector(properties.Position);
    const rot = readVector(properties.Rotation);
    const scale = readVector(properties.Scale, new THREE.Vector3(1, 1, 1));

    caja.position.copy(pos);

    caja.rotation.set(
        THREE.MathUtils.degToRad(rot.x),
        THREE.MathUtils.degToRad(rot.y),
        THREE.MathUtils.degToRad(rot.z)
    );

    caja.scale.copy(scale);

    caja.userData.type = entidad.type;
    caja.userData.name = entidad.name;
    caja.userData.source = entidad;

    return caja;
}

// ============================================================
// RESOLVER NOMBRE DEL MODELO A PARTIR DE LA ENTIDAD
// ============================================================
//
// En este formato de mapa hay dos formas de referenciar un modelo:
//
// 1) El propio "type" de la entidad ES la referencia al modelo/
//    template, con un "#" adelante. Ej:
//    "type": "#Building/BuildingBreakable_HutA"
//    -> nombre real: "Building/BuildingBreakable_HutA"
//
// 2) Entidades "VuGamePropEntity" que guardan la ruta del modelo
//    dentro de Components.Vu3dDrawStaticModelComponent.Properties
//    ["Model Asset"]. Ej: "Level/JungleA/Treeline"
//
function getModelName(entidad) {

    if (
        typeof entidad.type === "string" &&
        entidad.type.startsWith("#")
    ) {
        return entidad.type.slice(1);
    }

    const components =
        entidad?.data?.Components ||
        entidad?.data?.components;

    const drawComponent =
        components?.Vu3dDrawStaticModelComponent ||
        components?.vu3dDrawStaticModelComponent;

    const props =
        drawComponent?.Properties ||
        drawComponent?.properties;

    const modelAsset =
        props?.["Model Asset"] ||
        props?.ModelAsset ||
        props?.modelAsset;

    if (modelAsset) return modelAsset;

    return null;
}


async function crearObjetoDesdeEntidad(entidad, modelName) {

    // Cargamos el modelo automáticamente
    const modelo = await chargeModel(modelName);
    if (!modelo) return null;

    // Usamos el MISMO helper que ya usan los waypoints para leer
    // el transform (Position/Rotation/Scale reales de la entidad).
    // El grupo "world" ya tiene la rotación global de 90° aplicada
    // en init(), así que no hace falta invertir ejes a mano aquí.
    const transform = getTransformComponent(entidad);

    const properties =
        transform?.Properties ||
        transform?.properties ||
        {};

    const pos = readVector(properties.Position);
    const rot = readVector(properties.Rotation);
    const scale = readVector(properties.Scale, new THREE.Vector3(1, 1, 1));

    modelo.position.copy(pos);

    modelo.rotation.set(
        THREE.MathUtils.degToRad(rot.x),
        THREE.MathUtils.degToRad(rot.y),
        THREE.MathUtils.degToRad(rot.z)
    );

    modelo.scale.copy(scale);

    modelo.userData.type = entidad.type;
    modelo.userData.name = entidad.name || modelName;
    modelo.userData.source = entidad;

    // Agregamos a la escena y lista
    world.add(modelo);
    objects.push(modelo);

    return modelo;
}

// ============================================================
// LEER VECTOR
// ============================================================

function readVector(
    value,
    fallback = new THREE.Vector3()
) {

    if (
        !value
    ) {

        return fallback.clone();

    }


    if (
        Array.isArray(value)
    ) {

        return new THREE.Vector3(

            Number(
                value[0]
            ) || 0,

            Number(
                value[1]
            ) || 0,

            Number(
                value[2]
            ) || 0

        );

    }


    if (
        typeof value ===
        "object"
    ) {

        return new THREE.Vector3(

            Number(
                value.X ??
                value.x ??
                0
            ),

            Number(
                value.Y ??
                value.y ??
                0
            ),

            Number(
                value.Z ??
                value.z ??
                0
            )

        );

    }


    return fallback.clone();

}


// ============================================================
// ACTUALIZAR LISTA
// ============================================================

function updateObjectList() {

    objectList.innerHTML = "";


    if (
        !objects.length
    ) {

        objectList.innerHTML =
            `<div class="empty">
                No hay waypoints
             </div>`;

        return;

    }


    objects.forEach(
        (object, index) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "objectItem";


            if (
                object === selected
            ) {

                item.classList.add(
                    "selected"
                );

            }


            item.textContent =
                `${index + 1}. ${
                    object.userData.name ||
                    "Waypoint"
                }`;


            item.onclick =
                () => {

                    selectObject(
                        object
                    );

                    focusSelected();

                };


            objectList.appendChild(
                item
            );

        }
    );

}


// ============================================================
// INSPECTOR
// ============================================================

function updateInspector() {

    if (!selected) {

        noSelection.classList.remove(
            "hidden"
        );

        objectInspector.classList.add(
            "hidden"
        );

        return;

    }


    noSelection.classList.add(
        "hidden"
    );


    objectInspector.classList.remove(
        "hidden"
    );


    document.getElementById(
        "selectedName"
    ).textContent =
        selected.userData.name ||
        "Waypoint";


    setValue(
        "posX",
        selected.position.x
    );

    setValue(
        "posY",
        selected.position.y
    );

    setValue(
        "posZ",
        selected.position.z
    );


    setValue(
        "rotX",
        THREE.MathUtils.radToDeg(
            selected.rotation.x
        )
    );

    setValue(
        "rotY",
        THREE.MathUtils.radToDeg(
            selected.rotation.y
        )
    );

    setValue(
        "rotZ",
        THREE.MathUtils.radToDeg(
            selected.rotation.z
        )
    );


    setValue(
        "scaleX",
        selected.scale.x
    );

    setValue(
        "scaleY",
        selected.scale.y
    );

    setValue(
        "scaleZ",
        selected.scale.z
    );

}


// ============================================================
// SET VALUE
// ============================================================

function setValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element)
        return;


    element.value =
        Number(value)
            .toFixed(4);

}


// ============================================================
// APLICAR INSPECTOR
// ============================================================

function applyInspector() {

    if (!selected)
        return;


    selected.position.set(

        readNumber(
            "posX"
        ),

        readNumber(
            "posY"
        ),

        readNumber(
            "posZ"
        )

    );


    selected.rotation.set(

        THREE.MathUtils.degToRad(
            readNumber(
                "rotX"
            )
        ),

        THREE.MathUtils.degToRad(
            readNumber(
                "rotY"
            )
        ),

        THREE.MathUtils.degToRad(
            readNumber(
                "rotZ"
            )
        )

    );


    selected.scale.set(

        readNumber(
            "scaleX"
        ),

        readNumber(
            "scaleY"
        ),

        readNumber(
            "scaleZ"
        )

    );


    updateInspector();

}


// ============================================================
// LEER NÚMERO
// ============================================================

function readNumber(
    id
) {

    return Number(
        document.getElementById(
            id
        ).value
    ) || 0;

}


// ============================================================
// ENFOCAR OBJETO
// ============================================================

function focusSelected() {

    if (!selected)
        return;


    const box =
        new THREE.Box3()
            .setFromObject(
                selected
            );


    const center =
        box.getCenter(
            new THREE.Vector3()
        );


    const size =
        box.getSize(
            new THREE.Vector3()
        );


    const distance =
        Math.max(
            size.length() * 2,
            5
        );


    camera.position.copy(
        center
    );


    camera.position.x +=
        distance;


    camera.position.y +=
        distance;


    camera.position.z +=
        distance;


    orbit.target.copy(
        center
    );

}


// ============================================================
// ENFOCAR TODOS
// ============================================================

function focusAll() {

    if (
        !objects.length
    )
        return;


    const box =
        new THREE.Box3();


    for (
        const object
        of objects
    ) {

        box.expandByObject(
            object
        );

    }


    const center =
        box.getCenter(
            new THREE.Vector3()
        );


    const size =
        box.getSize(
            new THREE.Vector3()
        );


    const distance =
        Math.max(
            size.length() * 1.5,
            30
        );


    camera.position.set(

        center.x + distance,

        center.y + distance * 0.7,

        center.z + distance

    );


    orbit.target.copy(
        center
    );

}


// ============================================================
// BORRAR
// ============================================================

function deleteSelected() {

    if (!selected)
        return;


    // Antes borraba de "scene", pero los objetos viven dentro de
    // "world" -- por eso a veces el objeto "borrado" seguía
    // viéndose en pantalla.
    world.remove(
        selected
    );


    // También lo quitamos del propio mapData, para que no se
    // vuelva a exportar al darle Guardar.
    const entidad = selected.userData.source;
    if (entidad) {
        const contenedor = entidadAContenedor.get(entidad);
        if (contenedor) {
            const i = contenedor.indexOf(entidad);
            if (i !== -1) contenedor.splice(i, 1);
        }
    }


    const index =
        objects.indexOf(
            selected
        );


    if (
        index !== -1
    ) {

        objects.splice(
            index,
            1
        );

    }


    selected = null;


    transformControls.detach();


    updateInspector();

    updateObjectList();

}

// ============================================================
// COPIAR / PEGAR
// ============================================================
// Copia la entidad ORIGINAL del mapa (no una copia visual suelta),
// y al pegar la inserta en el mismo array del árbol que el
// original -- por eso sí se guarda bien con el botón Guardar.

function copiarSeleccionado() {

    const entidad = selected?.userData?.source;

    if (!entidad) {
        console.warn("No hay nada seleccionado (o es un objeto sin datos de mapa) para copiar.");
        return;
    }

    clipboard = clonarEntidad(entidad);
    console.log(`📋 Copiado: ${clipboard.name || clipboard.type}`);
}

async function pegarClipboard() {

    if (!clipboard) {
        console.warn("No hay nada copiado todavía.");
        return;
    }

    const nuevaEntidad = clonarEntidad(clipboard);
    pegadoCounter++;

    const nombreOriginal = nuevaEntidad.name || "Objeto";
    nuevaEntidad.name = `${nombreOriginal}_copia${pegadoCounter}`;

    // Evitamos romper la cadena de IA de waypoints: la copia queda
    // "suelta" (sin conexiones a otros waypoints) hasta que la
    // conectes a mano si hace falta.
    const scriptComp = nuevaEntidad?.data?.Components?.VuScriptComponent;
    if (scriptComp) {
        delete scriptComp.RefConnections;
        delete scriptComp.Refs;
    }

    // Desplazamos un poco la posición para que no quede exactamente
    // encima del original.
    const transform = getTransformComponent(nuevaEntidad);
    const properties = transform?.Properties || transform?.properties;
    if (properties?.Position) {
        properties.Position.X = (properties.Position.X || 0) + 3;
        properties.Position.Y = (properties.Position.Y || 0) + 3;
    }

    // La insertamos en el mismo contenedor (ChildEntities) que el
    // objeto del que se copió, para que exporte bien en Guardar.
    const original = selected?.userData?.source;
    const contenedorOriginal =
        entidadAContenedor.get(clipboard) ||
        (original && entidadAContenedor.get(original)) ||
        mapData?.RootEntity?.data?.ChildEntities;

    if (!contenedorOriginal) {
        console.warn("No se encontró dónde insertar la copia dentro del mapa.");
        return;
    }

    contenedorOriginal.push(nuevaEntidad);
    entidadAContenedor.set(nuevaEntidad, contenedorOriginal);

    // Creamos el objeto visual correspondiente
    let objetoVisual = null;

    if (nuevaEntidad.type === "VuAiWaypointEntity") {
        waypointCounter++;
        objetoVisual = createWaypointFromEntity(nuevaEntidad);
    } else {
        const modelName = getModelName(nuevaEntidad);
        if (modelName) {
            objetoVisual = await crearObjetoDesdeEntidad(nuevaEntidad, modelName);
        }
    }

    if (!objetoVisual) {
        console.warn("No se pudo crear la copia en la escena (¿tipo no soportado para pegar?).");
        return;
    }

    updateObjectList();
    selectObject(objetoVisual);
    focusSelected();

    console.log(`📥 Pegado: ${nuevaEntidad.name}`);
}



// ============================================================
// LIMPIAR ESCENA
// ============================================================

function clearObjects() {

    for (
        const object
        of objects
    ) {

        scene.remove(
            object
        );


        disposeObject(
            object
        );

    }


    objects = [];


    selected = null;


    transformControls.detach();


    updateInspector();

}


// ============================================================
// DISPOSE
// ============================================================

function disposeObject(
    object
) {

    object.traverse(
        child => {

            if (
                child.geometry
            ) {

                child.geometry.dispose();

            }


            if (
                child.material
            ) {

                if (
                    Array.isArray(
                        child.material
                    )
                ) {

                    child.material.forEach(
                        material =>
                            disposeMaterial(
                                material
                            )
                    );

                }
                else {

                    disposeMaterial(
                        child.material
                    );

                }

            }

        }
    );

}


// ============================================================
// DISPOSE MATERIAL
// ============================================================

function disposeMaterial(
    material
) {

    if (
        material.map
    ) {

        material.map.dispose();

    }


    material.dispose();

}


// ============================================================
// GUARDAR
// ============================================================

function saveMap() {

    if (!mapData) {
        console.warn("No hay un mapa cargado para guardar.");
        return;
    }

    let actualizados = 0;

    // Recorremos los objetos de la escena y escribimos los valores
    // actuales DIRECTO sobre la entidad original dentro de mapData
    // (object.userData.source es la MISMA referencia, no una copia).
    // Así solo se tocan Position/Rotation/Scale; todo lo demás de
    // la entidad (componentes, ids, nombres, etc.) queda intacto.
    for (const object of objects) {

        const entidad = object.userData.source;
        if (!entidad) continue;

        const transform = getTransformComponent(entidad);
        const properties = transform?.Properties || transform?.properties;
        if (!properties) continue;

        properties.Position = {
            X: object.position.x,
            Y: object.position.y,
            Z: object.position.z
        };

        properties.Rotation = {
            X: THREE.MathUtils.radToDeg(object.rotation.x),
            Y: THREE.MathUtils.radToDeg(object.rotation.y),
            Z: THREE.MathUtils.radToDeg(object.rotation.z)
        };

        properties.Scale = {
            X: object.scale.x,
            Y: object.scale.y,
            Z: object.scale.z
        };

        actualizados++;
    }

    console.log(`💾 ${actualizados} entidades actualizadas (posición/rotación/escala) sobre el mapa original.`);

    // Exportamos el mapa COMPLETO y ORIGINAL, ya con los valores
    // nuevos escritos encima -- mismo formato que el JSON que
    // importaste, sin estructuras inventadas.
    const blob =
        new Blob(

            [
                JSON.stringify(
                    mapData,
                    null,
                    2
                )
            ],

            {
                type:
                    "application/json"
            }

        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        "BeachB_bin.json";


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1000
    );

}


// ============================================================
// TECLADO
// ============================================================

function onKeyDown(event) {

    if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "c" || event.key === "C")
    ) {

        copiarSeleccionado();
        return;

    }


    if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "v" || event.key === "V")
    ) {

        pegarClipboard();
        return;

    }


    if (
        !selected
    )
        return;


    if (
        event.key === "w" ||
        event.key === "W"
    ) {

        transformControls.setMode(
            "translate"
        );

    }


    if (
        event.key === "e" ||
        event.key === "E"
    ) {

        transformControls.setMode(
            "rotate"
        );

    }


    if (
        event.key === "r" ||
        event.key === "R"
    ) {

        transformControls.setMode(
            "scale"
        );

    }


    if (
        event.key === "Delete"
    ) {

        deleteSelected();

    }

}


// ============================================================
// INICIAR
// ============================================================

init();
