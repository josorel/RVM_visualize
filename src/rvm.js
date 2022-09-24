import * as THREE from '../node_modules/three/build/three.module.js';
// import Stats from '../vendor/stats.module.js';
import { GUI } from '../node_modules/dat.gui/build/dat.gui.module.js';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from '../node_modules/three/examples/jsm/lines/Line2.js';
// import * as MeshLine from '../vender/THREE.MeshLine.js';
import { LineMaterial } from '../node_modules/three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from '../node_modules/three/examples/jsm/lines/LineGeometry.js';

const width = window.innerWidth;
const height = window.innerHeight;
const aspect = width / height;
var renderer = new THREE.WebGLRenderer({
  // canvas: canvas,
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setSize(width, height);
const canvas = renderer.domElement;
document.body.appendChild(canvas);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
// THREE.Object3D.DefaultUp.set(0.5,0.0,0.8);
var camera = new THREE.PerspectiveCamera(30, width / height, 1, 1000);
camera.position.z = 0;
camera.position.x = 80;
camera.up.set(0, 0, 1);
camera.lookAt(new THREE.Vector3(0, 0, 0));

var controls = new OrbitControls(camera, renderer.domElement);
controls.enableKeys = false;

var star_radius = 1.0;
var star_geometry = new THREE.SphereGeometry(radius, 64, 64);
var star_material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
// var material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
var star_mesh = new THREE.Mesh(star_geometry, star_material);
scene.add(star_mesh);

function animate() {
  requestAnimationFrame(animate, canvas);
  // stats.begin();
  // if(!instance.active || sample_defaults.paused) return;

  // field_lines.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), 0.003);
  // closed_lines.visible = conf.show_closed;

  renderer.render(scene, camera);
  // stats.end();
}

animate();
