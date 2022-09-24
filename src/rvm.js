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

/// Config contains the physical and visualization parameters
var Config = function () {
  this.dipole_angle = 10.0;
  this.obs_angle = 45.0;
  this.pl_radius = 30.0;
  this.x_mode = true;
  this.o_mode = false;
}
var conf = new Config();
var q_dipole = new THREE.Quaternion();
var q_dipole_inv = new THREE.Quaternion();

function update_quaternion() {
  q_dipole.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * conf.dipole_angle / 180.0);
  q_dipole_inv.copy(q_dipole);
  q_dipole_inv.invert();
}

update_quaternion();

/// Setting up the scene
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
// THREE.Object3D.DefaultUp.set(0.5,0.0,0.8);
var camera = new THREE.PerspectiveCamera(30, width / height, 1, 1000);
camera.position.z = 30;
camera.position.x = 160;
camera.up.set(0, 0, 1);
camera.lookAt(new THREE.Vector3(0, 0, 0));

var controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableKeys = false;

/// Add the neutron star
var star_radius = 1.0;
var star_geometry = new THREE.SphereGeometry(star_radius, 64, 64);
var star_material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
var star_mesh = new THREE.Mesh(star_geometry, star_material);
scene.add(star_mesh);

/// Add polarization limiting sphere
var pl_geometry = new THREE.SphereGeometry(1.0, 64, 64);
var pl_material = new THREE.MeshPhongMaterial({ color: 0xffffff,
                                                transparent: true,
                                                depthWrite: false });
pl_material.opacity = 0.3;
var pl_mesh = new THREE.Mesh(pl_geometry, pl_material);
pl_mesh.scale.setScalar(conf.pl_radius);
scene.add(pl_mesh);

/// Add a spin axis
var axis_geometry = new THREE.BufferGeometry();
const axis_vertices = new Float32Array( [
  0, 0, -300,
  0, 0, 300
] );
axis_geometry.setAttribute( 'position', new THREE.BufferAttribute( axis_vertices, 3 ) );
var z_line = new THREE.Line(axis_geometry, new THREE.LineBasicMaterial({
  color: 0x8080aa,
  linewidth: 2.5,
}));
scene.add(z_line);

/// Add lighting to the star and other meshes
var directionalLight = new THREE.DirectionalLight(0xffffffff);
directionalLight.position.set(107, 107, 107);
scene.add(directionalLight);

var light = new THREE.AmbientLight(0x404040); // soft white light
scene.add(light);

/// Defining a group for the field lines and polarization vectors
var field_lines = new THREE.Group();
var polarization_vectors = new THREE.Group();
var intersect_points = [];

function clear_group(group) {
  for (var i = group.children.length - 1; i >= 0; i--) {
    if (group.children[i].name == "line") {
      var obj = group.children[i];
      obj.material.dispose();
      obj.geometry.dispose();
      group.remove(obj);
    } else if (group.children[i].name == "arrow") {
      var obj = group.children[i];
      group.remove(obj);
    }
  }
}

function create_fieldlines(th_obs, r_pl, n_lines, n_segments) {
  // clear the intersection points array first
  intersect_points.length = 0;

  for (var i = 0; i < n_lines; i++) {
    var phi = i * 2.0 * Math.PI / n_lines;
    // At r_pl, the angle of the intersection point is th_obs
    var p_intersect = new THREE.Vector3(r_pl * Math.sin(th_obs) * Math.cos(phi),
                                        r_pl * Math.sin(th_obs) * Math.sin(phi),
                                        r_pl * Math.cos(th_obs));
    var p_copy = new THREE.Vector3();
    p_copy.copy(p_intersect);
    intersect_points.push(p_copy);
    // Find the intersection point in the magnetic dipole frame
    p_intersect.applyQuaternion(q_dipole);
    // Find the stellar footpoint theta
    var th_intersect = Math.acos(p_intersect.z / r_pl);
    var th_foot = Math.asin(Math.sqrt(1.0 / r_pl * (Math.sin(th_intersect)**2)));
    var r_max = 1.0 / Math.sin(th_foot)**2;
    var phi_line = Math.atan2(p_intersect.y, p_intersect.x);
    var line_pos = []
    for (var j = 0; j <= n_segments; j++) {
      var th = th_foot + j * (Math.PI - 2.0 * th_foot) / n_segments;
      var r = r_max * Math.sin(th)**2;
      var p = new THREE.Vector3(r * Math.sin(th) * Math.cos(phi_line),
                                r * Math.sin(th) * Math.sin(phi_line),
                                r * Math.cos(th));
      // Rotate it back to the lab frame
      p.applyQuaternion(q_dipole_inv);
      line_pos.push(p.x, p.y, p.z);
    }
    const line_geometry = new LineGeometry();
    line_geometry.setPositions( line_pos );

    var line_matLine = new LineMaterial( {
      color: 0x33dd33,
      worldUnits: true,
      linewidth: 0.15, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      // alphaTest: 0.5,
      // depthTest: false,

      // resolution:  to be set by renderer, eventually
      dashed: false,
      // alphaToCoverage: true,
      transparent: true,
      opacity: 0.7,
      // blending: THREE.NormalBlending,
    } );

    var l = new Line2( line_geometry, line_matLine );
    l.computeLineDistances();
    l.name = "line";
    field_lines.add(l);
  }
}

function create_polarization_vectors() {
  var m = new THREE.Vector3(0, Math.sin(conf.dipole_angle * Math.PI / 180),
                            Math.cos(conf.dipole_angle * Math.PI / 180));
  // m.negate();
  var r = conf.pl_radius;

  for (const p of intersect_points) {
    var b = new THREE.Vector3();
    b.copy(p);
    b.multiplyScalar(3.0 * m.dot(p) / Math.pow(r, 5));
    var b2 = new THREE.Vector3();
    b2.copy(m);
    b2.multiplyScalar(1.0 / Math.pow(r, 3));
    b.sub(b2);
    var dir = new THREE.Vector3();
    dir.crossVectors(p, b);
    dir.normalize();
    if (conf.o_mode) {
      dir.cross(p);
      dir.normalize();
    }

    const arrow = new THREE.ArrowHelper( dir, p, 3.0, 0xdd4433 );
    arrow.name = "arrow";
    polarization_vectors.add(arrow);
  }
}

create_fieldlines(conf.obs_angle * Math.PI / 180, conf.pl_radius, 20, 100);
scene.add(field_lines);
create_polarization_vectors();
scene.add(polarization_vectors);

function update_fieldline() {
  update_quaternion();
  // remove_fieldlines();
  clear_group(field_lines);
  clear_group(polarization_vectors);
  create_fieldlines(conf.obs_angle * Math.PI / 180, conf.pl_radius, 20, 100);
  create_polarization_vectors();
}

/// A circle to visualize the trajectory of observing angle
var obs_circ_pos = [];
var obs_circ_n_segments = 100;
for (var i = 0; i <= obs_circ_n_segments; i++) {
  var phi = i * 2.0 * Math.PI / obs_circ_n_segments;
  obs_circ_pos.push(Math.cos(phi), Math.sin(phi), 0.0);
}
const obs_circ_geometry = new LineGeometry();
obs_circ_geometry.setPositions( obs_circ_pos );

var obs_circ_matLine = new LineMaterial( {
  color: "aqua",
  worldUnits: true,
  linewidth: 0.15, // in world units with size attenuation, pixels otherwise
  vertexColors: false,
  // alphaTest: 0.5,
  // depthTest: false,

  // resolution:  to be set by renderer, eventually
  dashed: false,
  // alphaToCoverage: true,
  transparent: true,
  opacity: 0.7,
  // blending: THREE.NormalBlending,
} );

var obs_circ = new Line2( obs_circ_geometry, obs_circ_matLine );
obs_circ.computeLineDistances();
scene.add(obs_circ);
obs_circ.scale.setScalar(conf.pl_radius * Math.sin(conf.obs_angle * Math.PI / 180));
obs_circ.position.setZ(conf.pl_radius * Math.cos(conf.obs_angle * Math.PI / 180));

function update_pl_sphere() {
  pl_mesh.scale.setScalar(conf.pl_radius);
  obs_circ.scale.setScalar(conf.pl_radius * Math.sin(conf.obs_angle * Math.PI / 180));
  obs_circ.position.setZ(conf.pl_radius * Math.cos(conf.obs_angle * Math.PI / 180));
  update_fieldline();
}

function switch_o_mode() {
  conf.o_mode = true;
  conf.x_mode = false;
  update_fieldline();
}

function switch_x_mode() {
  conf.o_mode = false;
  conf.x_mode = true;
  update_fieldline();
}

const gui = new GUI();
gui.add(conf, "pl_radius", 1.0, 100.0).listen().onChange(update_pl_sphere);
gui.add(conf, "obs_angle", 0.0, 90.0).listen().onChange(update_pl_sphere);
gui.add(conf, "dipole_angle", 0.0, 90.0).listen().onChange(update_pl_sphere);
gui.add(conf, "o_mode").listen().onChange(switch_o_mode);
gui.add(conf, "x_mode").listen().onChange(switch_x_mode);

function animate() {
  requestAnimationFrame(animate, canvas);
  // stats.begin();
  // if(!instance.active || sample_defaults.paused) return;

  // field_lines.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), 0.003);
  // closed_lines.visible = conf.show_closed;

  renderer.render(scene, camera);
  controls.update();
  // stats.end();
}

animate();
