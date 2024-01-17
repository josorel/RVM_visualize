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
const canvas = document.getElementById("vis");
var renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setSize(width, height);
// const canvas = renderer.domElement;
// document.body.appendChild(canvas);

/// Config contains the physical and visualization parameters
var Config = function () {
  this.dipole_angle = 10.0;
  this.obs_angle = 45.0;
  this.pl_radius = 30.0;
  this.x_mode = true;
  this.o_mode = false;
  this.rotating = false;
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
var camera_d = 160;
camera.position.z = camera_d * Math.cos(80 * Math.PI / 180);
camera.position.x = camera_d * Math.sin(80 * Math.PI / 180);
camera.up.set(0, 0, 1);
camera.lookAt(new THREE.Vector3(0, 0, 0));

var controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableKeys = false;

/// Add the neutron star
// var star_radius = 1.0;
var star_geometry = new THREE.SphereGeometry(1.0, 64, 64);
var star_material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
var star_mesh = new THREE.Mesh(star_geometry, star_material);
scene.add(star_mesh);

/// Add polarization limiting sphere
var pl_geometry = new THREE.SphereGeometry(1.0, 64, 64);
var pl_material = new THREE.MeshPhongMaterial({ color: 0xffffff,
                                                transparent: true,
                                                depthWrite: false,
                                                // blending: THREE.AdditiveBlending,
                                                blending: THREE.NormalBlending,
                                              });
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
    var colors = []
    for (var j = 0; j <= n_segments; j++) {
      var th = th_foot + j * (Math.PI - 2.0 * th_foot) / n_segments;
      var r = r_max * Math.sin(th)**2;
      var p = new THREE.Vector3(r * Math.sin(th) * Math.cos(phi_line),
                                r * Math.sin(th) * Math.sin(phi_line),
                                r * Math.cos(th));
      // Rotate it back to the lab frame
      p.applyQuaternion(q_dipole_inv);
      line_pos.push(p.x, p.y, p.z);
      colors.push(0.1, 0.8, 0.1);
    }
    const line_geometry = new LineGeometry();
    line_geometry.setPositions( line_pos );
    line_geometry.setColors( colors );

    var line_matLine = new LineMaterial( {
      color: 0x33dd33,
      worldUnits: true,
      linewidth: 0.15, // in world units with size attenuation, pixels otherwise
      vertexColors: true,
      alphaTest: 0.5,
      // depthTest: false,

      // resolution:  to be set by renderer, eventually
      dashed: false,
      alphaToCoverage: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.NormalBlending,
      // blending: THREE.SubtractiveBlending,
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
gui.add(conf, "rotating").listen();

var guiFunctions = function () {
  this.set_observer = function () {
    camera.position.set(camera_d * Math.sin(conf.obs_angle * Math.PI / 180), 0,
                        camera_d * Math.cos(conf.obs_angle * Math.PI / 180));
  }
}
var gui_func = new guiFunctions();
gui.add(gui_func, "set_observer");

var rotation_speed = 0.004;

function animate() {
  requestAnimationFrame(animate, canvas);
  // stats.begin();
  // if(!instance.active || sample_defaults.paused) return;

  if (conf.rotating) {
    field_lines.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), rotation_speed);
    polarization_vectors.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), rotation_speed);
  }
  // closed_lines.visible = conf.show_closed;

  renderer.render(scene, camera);
  controls.update();
  // stats.end();
}

animate();

//------------------------------------------------------------------------------------------------------------------------

const canvas2 = document.getElementById("plot");

const devicePixelRatio = window.devicePixelRatio || 1;
canvas2.width = canvas2.clientWidth * devicePixelRatio;
canvas2.height = canvas2.clientHeight * devicePixelRatio;

const numX = canvas2.width;

const color = new WebglPlotBundle.ColorRGBA(Math.random(), Math.random(), Math.random(), 1);

const line = new WebglPlotBundle.WebglLine(color, numX);

const wglp = new WebglPlotBundle.WebglPlot(canvas2);

line.lineSpaceX(-1, 2 / numX);
wglp.addLine(line);

function newFrame() {
  update();
  wglp.update();
  requestAnimationFrame(newFrame);
}
requestAnimationFrame(newFrame);

function update() {
  const freq = 0.001;
  const amp = 0.5;
  const noise = 0.1;

  for (let i = 0; i < line.numPoints; i++) {
    const ySin = Math.sin(Math.PI * i * freq * Math.PI * 2);
    const yNoise = Math.random() - 0.5;
    line.setY(i, ySin * amp + yNoise * noise);
  }
}

//------------------------------------------------------------------------------------------------------------------------

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.WebglPlotBundle = {}));
})(this, (function (exports) { 'use strict';

  class ColorRGBA {
      r;
      g;
      b;
      a;
      constructor(r, g, b, a) {
          this.r = r;
          this.g = g;
          this.b = b;
          this.a = a;
      }
  }

  /**
   * Baseline class
   */
  class WebglBase {
      //private static program: WebGLProgram;
      intensity;
      visible;
      /**
       * The number of data point pairs in the line
       */
      numPoints;
      /**
       * The data ponits for webgl array
       * @internal
       */
      xy;
      /**
       * The Color of the line
       */
      color;
      /**
       * The horizontal scale of the line
       * @default = 1
       */
      scaleX;
      /**
       * The vertical scale of the line
       * @default = 1
       */
      scaleY;
      /**
       * The horizontal offset of the line
       * @default = 0
       */
      offsetX;
      /**
       * the vertical offset of the line
       * @default = 0
       */
      offsetY;
      /**
       * if this is a close loop line or not
       * @default = false
       */
      loop;
      /**
       * total webgl number of points
       * @internal
       */
      webglNumPoints;
      /**
       * @private
       * @internal
       */
      _vbuffer;
      /**
       * @private
       * @internal
       */
      //public _prog: WebGLProgram;
      /**
       * @private
       * @internal
       */
      _coord;
      /**
       * @internal
       */
      constructor() {
          this.scaleX = 1;
          this.scaleY = 1;
          this.offsetX = 0;
          this.offsetY = 0;
          this.loop = false;
          this._vbuffer = 0;
          this._coord = 0;
          this.visible = true;
          this.intensity = 1;
          this.xy = new Float32Array([]);
          this.numPoints = 0;
          this.color = new ColorRGBA(0, 0, 0, 1);
          this.webglNumPoints = 0;
      }
  }

  /**
   * The standard Line class
   */
  class WebglLine extends WebglBase {
      currentIndex = 0;
      /**
       * Create a new line
       * @param c - the color of the line
       * @param numPoints - number of data pints
       * @example
       * ```typescript
       * x= [0,1]
       * y= [1,2]
       * line = new WebglLine( new ColorRGBA(0.1,0.1,0.1,1), 2);
       * ```
       */
      constructor(c, numPoints) {
          super();
          this.webglNumPoints = numPoints;
          this.numPoints = numPoints;
          this.color = c;
          this.xy = new Float32Array(2 * this.webglNumPoints);
      }
      /**
       * Set the X value at a specific index
       * @param index - the index of the data point
       * @param x - the horizontal value of the data point
       */
      setX(index, x) {
          this.xy[index * 2] = x;
      }
      /**
       * Set the Y value at a specific index
       * @param index : the index of the data point
       * @param y : the vertical value of the data point
       */
      setY(index, y) {
          this.xy[index * 2 + 1] = y;
      }
      /**
       * Get an X value at a specific index
       * @param index - the index of X
       */
      getX(index) {
          return this.xy[index * 2];
      }
      /**
       * Get an Y value at a specific index
       * @param index - the index of Y
       */
      getY(index) {
          return this.xy[index * 2 + 1];
      }
      /**
       * Make an equally spaced array of X points
       * @param start  - the start of the series
       * @param stepSize - step size between each data point
       *
       * @example
       * ```typescript
       * //x = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8]
       * const numX = 10;
       * line.lineSpaceX(-1, 2 / numX);
       * ```
       */
      lineSpaceX(start, stepSize) {
          for (let i = 0; i < this.numPoints; i++) {
              // set x to -num/2:1:+num/2
              this.setX(i, start + stepSize * i);
          }
      }
      /**
       * Automatically generate X between -1 and 1
       * equal to lineSpaceX(-1, 2/ number of points)
       */
      arrangeX() {
          this.lineSpaceX(-1, 2 / this.numPoints);
      }
      /**
       * Set a constant value for all Y values in the line
       * @param c - constant value
       */
      constY(c) {
          for (let i = 0; i < this.numPoints; i++) {
              // set x to -num/2:1:+num/2
              this.setY(i, c);
          }
      }
      /**
       * Add a new Y values to the end of current array and shift it, so that the total number of the pair remains the same
       * @param data - the Y array
       *
       * @example
       * ```typescript
       * yArray = new Float32Array([3, 4, 5]);
       * line.shiftAdd(yArray);
       * ```
       */
      shiftAdd(data) {
          const shiftSize = data.length;
          for (let i = 0; i < this.numPoints - shiftSize; i++) {
              this.setY(i, this.getY(i + shiftSize));
          }
          for (let i = 0; i < shiftSize; i++) {
              this.setY(i + this.numPoints - shiftSize, data[i]);
          }
      }
      /**
       * Add new Y values to the line and maintain the position of the last data point
       */
      addArrayY(yArray) {
          if (this.currentIndex + yArray.length <= this.numPoints) {
              for (let i = 0; i < yArray.length; i++) {
                  this.setY(this.currentIndex, yArray[i]);
                  this.currentIndex++;
              }
          }
      }
      /**
       * Replace the all Y values of the line
       */
      replaceArrayY(yArray) {
          if (yArray.length == this.numPoints) {
              for (let i = 0; i < this.numPoints; i++) {
                  this.setY(i, yArray[i]);
              }
          }
      }
  }

  /**
   * The step based line plot
   */
  class WebglStep extends WebglBase {
      /**
       * Create a new step line
       * @param c - the color of the line
       * @param numPoints - number of data pints
       * @example
       * ```typescript
       * x= [0,1]
       * y= [1,2]
       * line = new WebglStep( new ColorRGBA(0.1,0.1,0.1,1), 2);
       * ```
       */
      constructor(c, num) {
          super();
          this.webglNumPoints = num * 2;
          this.numPoints = num;
          this.color = c;
          this.xy = new Float32Array(2 * this.webglNumPoints);
      }
      /**
       * Set the Y value at a specific index
       * @param index - the index of the data point
       * @param y - the vertical value of the data point
       */
      setY(index, y) {
          this.xy[index * 4 + 1] = y;
          this.xy[index * 4 + 3] = y;
      }
      getX(index) {
          return this.xy[index * 4];
      }
      /**
       * Get an X value at a specific index
       * @param index - the index of X
       */
      getY(index) {
          return this.xy[index * 4 + 1];
      }
      /**
       * Make an equally spaced array of X points
       * @param start  - the start of the series
       * @param stepSize - step size between each data point
       *
       * @example
       * ```typescript
       * //x = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8]
       * const numX = 10;
       * line.lineSpaceX(-1, 2 / numX);
       * ```
       */
      lineSpaceX(start, stepsize) {
          for (let i = 0; i < this.numPoints; i++) {
              // set x to -num/2:1:+num/2
              this.xy[i * 4] = start + i * stepsize;
              this.xy[i * 4 + 2] = start + (i * stepsize + stepsize);
          }
      }
      /**
       * Set a constant value for all Y values in the line
       * @param c - constant value
       */
      constY(c) {
          for (let i = 0; i < this.numPoints; i++) {
              // set x to -num/2:1:+num/2
              this.setY(i, c);
          }
      }
      /**
       * Add a new Y values to the end of current array and shift it, so that the total number of the pair remains the same
       * @param data - the Y array
       *
       * @example
       * ```typescript
       * yArray = new Float32Array([3, 4, 5]);
       * line.shiftAdd(yArray);
       * ```
       */
      shiftAdd(data) {
          const shiftSize = data.length;
          for (let i = 0; i < this.numPoints - shiftSize; i++) {
              this.setY(i, this.getY(i + shiftSize));
          }
          for (let i = 0; i < shiftSize; i++) {
              this.setY(i + this.numPoints - shiftSize, data[i]);
          }
      }
  }

  class WebglPolar extends WebglBase {
      numPoints;
      xy;
      color;
      intenisty;
      visible;
      offsetTheta;
      constructor(c, numPoints) {
          super();
          this.webglNumPoints = numPoints;
          this.numPoints = numPoints;
          this.color = c;
          this.intenisty = 1;
          this.xy = new Float32Array(2 * this.webglNumPoints);
          this._vbuffer = 0;
          this._coord = 0;
          this.visible = true;
          this.offsetTheta = 0;
      }
      /**
       * @param index: index of the line
       * @param theta : angle in deg
       * @param r : radius
       */
      setRtheta(index, theta, r) {
          //const rA = Math.abs(r);
          //const thetaA = theta % 360;
          const x = r * Math.cos((2 * Math.PI * (theta + this.offsetTheta)) / 360);
          const y = r * Math.sin((2 * Math.PI * (theta + this.offsetTheta)) / 360);
          //const index = Math.round( ((theta % 360)/360) * this.numPoints );
          this.setX(index, x);
          this.setY(index, y);
      }
      getTheta(index) {
          //return Math.tan
          return 0;
      }
      getR(index) {
          //return Math.tan
          return Math.sqrt(Math.pow(this.getX(index), 2) + Math.pow(this.getY(index), 2));
      }
      setX(index, x) {
          this.xy[index * 2] = x;
      }
      setY(index, y) {
          this.xy[index * 2 + 1] = y;
      }
      getX(index) {
          return this.xy[index * 2];
      }
      getY(index) {
          return this.xy[index * 2 + 1];
      }
  }

  /**
   * The Square class
   */
  class WebglSquare extends WebglBase {
      /**
       * Create a new line
       * @param c - the color of the line
       * @example
       * ```typescript
       * line = new WebglSquare( new ColorRGBA(0.1,0.1,0.1,0.5) );
       * ```
       */
      constructor(c) {
          super();
          this.webglNumPoints = 4;
          this.numPoints = 4;
          this.color = c;
          this.xy = new Float32Array(2 * this.webglNumPoints);
      }
      /**
       * draw a square
       * @param x1 start x
       * @param y1 start y
       * @param x2 end x
       * @param y2 end y
       */
      setSquare(x1, y1, x2, y2) {
          this.xy = new Float32Array([x1, y1, x1, y2, x2, y1, x2, y2]);
      }
  }

  /**
   * modified functions from:
   * https://github.com/stackgl/gl-vec2
   * See License2.md for more info
   */
  const scaleAndAdd = (a, b, scale) => {
      const out = { x: 0, y: 0 };
      out.x = a.x + b.x * scale;
      out.y = a.y + b.y * scale;
      return out;
  };
  const normal = (dir) => {
      //get perpendicular
      const out = set(-dir.y, dir.x);
      return out;
  };
  const direction = (a, b) => {
      //get unit dir of two lines
      let out = subtract(a, b);
      out = normalize(out);
      return out;
  };
  /**
   * Adds two vec2's
   *
   * @param {vec2} out the receiving vector
   * @param {vec2} a the first operand
   * @param {vec2} b the second operand
   * @returns {vec2} out
   */
  const add = (a, b) => {
      const out = { x: 0, y: 0 };
      out.x = a.x + b.x;
      out.y = a.y + b.y;
      return out;
  };
  /**
   * Calculates the dot product of two vec2's
   *
   * @param {vec2} a the first operand
   * @param {vec2} b the second operand
   * @returns {Number} dot product of a and b
   */
  const dot = (a, b) => {
      return a.x * b.x + a.y * b.y;
  };
  /**
   * Normalize a vec2
   *
   * @param {vec2} out the receiving vector
   * @param {vec2} a vector to normalize
   * @returns {vec2} out
   */
  const normalize = (a) => {
      const out = { x: 0, y: 0 };
      let len = a.x * a.x + a.y * a.y;
      if (len > 0) {
          //TODO: evaluate use of glm_invsqrt here?
          len = 1 / Math.sqrt(len);
          out.x = a.x * len;
          out.y = a.y * len;
      }
      return out;
  };
  /**
   * Set the components of a vec2 to the given values
   *
   * @param {vec2} out the receiving vector
   * @param {Number} x X component
   * @param {Number} y Y component
   * @returns {vec2} out
   */
  const set = (x, y) => {
      const out = { x: 0, y: 0 };
      out.x = x;
      out.y = y;
      return out;
  };
  /**
   * Subtracts vector b from vector a
   *
   * @param {vec2} out the receiving vector
   * @param {vec2} a the first operand
   * @param {vec2} b the second operand
   * @returns {vec2} out
   */
  const subtract = (a, b) => {
      const out = { x: 0, y: 0 };
      out.x = a.x - b.x;
      out.y = a.y - b.y;
      return out;
  };

  /**
   * inspired and modified from:
   * https://github.com/mattdesl/polyline-normals
   * See License1.md for more info
   */
  const PolyLine = (lineXY) => {
      let curNormal;
      let lineA = { x: 0, y: 0 };
      let lineB = { x: 0, y: 0 };
      const out = [];
      const addNext = (normal, length) => {
          out.push({ vec2: normal, miterLength: length });
      };
      const getXY = (index) => {
          return { x: lineXY[index * 2], y: lineXY[index * 2 + 1] };
      };
      // add initial normals
      lineA = direction(getXY(1), getXY(0));
      curNormal = normal(lineA);
      addNext(curNormal, 1);
      const numPoints = lineXY.length / 2;
      for (let i = 1; i < numPoints - 1; i++) {
          const last = getXY(i - 1);
          const cur = getXY(i);
          const next = getXY(i + 1);
          lineA = direction(cur, last);
          curNormal = normal(lineA);
          lineB = direction(next, cur);
          //stores tangent & miter
          const miter = computeMiter(lineA, lineB);
          const miterLen = computeMiterLen(lineA, miter, 1);
          addNext(miter, miterLen);
      }
      // add last normal
      // no miter, simple segment
      lineA = direction(getXY(numPoints - 1), getXY(numPoints - 2));
      curNormal = normal(lineA); //reset normal
      addNext(curNormal, 1);
      return out;
  };
  const computeMiter = (lineA, lineB) => {
      //get tangent line
      let tangent = add(lineA, lineB);
      tangent = normalize(tangent);
      //get miter as a unit vector
      const miter = set(-tangent.y, tangent.x);
      return miter;
  };
  const computeMiterLen = (lineA, miter, halfThick) => {
      const tmp = set(-lineA.y, lineA.x);
      //get the necessary length of our miter
      return halfThick / dot(miter, tmp);
  };

  /**
   * The standard Line class
   */
  class WebglThickLine extends WebglBase {
      currentIndex = 0;
      //protected triPoints: Float32Array;
      _linePoints;
      _thicknessRequested = 0;
      _actualThickness = 0;
      /**
       * Create a new line
       * @param c - the color of the line
       * @param numPoints - number of data pints
       * @example
       * ```typescript
       * x= [0,1]
       * y= [1,2]
       * line = new WebglLine( new ColorRGBA(0.1,0.1,0.1,1), 2);
       * ```
       */
      constructor(c, numPoints, thickness) {
          super();
          this.webglNumPoints = numPoints * 2;
          this.numPoints = numPoints;
          this.color = c;
          this._thicknessRequested = thickness;
          this._linePoints = new Float32Array(numPoints * 2);
          //this.triPoints = new Float32Array(this.numPoints * 4);
          this.xy = new Float32Array(2 * this.webglNumPoints);
      }
      convertToTriPoints() {
          //const thick = 0.01;
          const halfThick = this._actualThickness / 2;
          const normals = PolyLine(this._linePoints);
          //console.log(this.linePoints);
          //console.log(normals);
          for (let i = 0; i < this.numPoints; i++) {
              const x = this._linePoints[2 * i];
              const y = this._linePoints[2 * i + 1];
              const point = { x: x, y: y };
              const top = scaleAndAdd(point, normals[i].vec2, normals[i].miterLength * halfThick);
              const bot = scaleAndAdd(point, normals[i].vec2, -normals[i].miterLength * halfThick);
              this.xy[i * 4] = top.x;
              this.xy[i * 4 + 1] = top.y;
              this.xy[i * 4 + 2] = bot.x;
              this.xy[i * 4 + 3] = bot.y;
          }
      }
      /**
       * Set the X value at a specific index
       * @param index - the index of the data point
       * @param x - the horizontal value of the data point
       */
      setX(index, x) {
          this._linePoints[index * 2] = x;
      }
      /**
       * Set the Y value at a specific index
       * @param index : the index of the data point
       * @param y : the vertical value of the data point
       */
      setY(index, y) {
          this._linePoints[index * 2 + 1] = y;
      }
      /**
       * Make an equally spaced array of X points
       * @param start  - the start of the series
       * @param stepSize - step size between each data point
       *
       * @example
       * ```typescript
       * //x = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8]
       * const numX = 10;
       * line.lineSpaceX(-1, 2 / numX);
       * ```
       */
      lineSpaceX(start, stepSize) {
          for (let i = 0; i < this.numPoints; i++) {
              // set x to -num/2:1:+num/2
              this.setX(i, start + stepSize * i);
          }
      }
      setThickness(thickness) {
          this._thicknessRequested = thickness;
      }
      getThickness() {
          return this._thicknessRequested;
      }
      setActualThickness(thickness) {
          this._actualThickness = thickness;
      }
  }

  /**
   * Author Danial Chitnis 2019-20
   *
   * inspired by:
   * https://codepen.io/AzazelN28
   * https://www.tutorialspoint.com/webgl/webgl_modes_of_drawing.htm
   */
  /**
   * The main class for the webgl-plot library
   */
  class WebglPlot {
      /**
       * @private
       */
      webgl;
      /**
       * Global horizontal scale factor
       * @default = 1.0
       */
      gScaleX;
      /**
       * Global vertical scale factor
       * @default = 1.0
       */
      gScaleY;
      /**
       * Global X/Y scale ratio
       * @default = 1
       */
      gXYratio;
      /**
       * Global horizontal offset
       * @default = 0
       */
      gOffsetX;
      /**
       * Global vertical offset
       * @default = 0
       */
      gOffsetY;
      /**
       * Global log10 of x-axis
       * @default = false
       */
      gLog10X;
      /**
       * Global log10 of y-axis
       * @default = false
       */
      gLog10Y;
      /**
       * collection of data lines in the plot
       */
      _linesData;
      /**
       * collection of auxiliary lines (grids, markers, etc) in the plot
       */
      _linesAux;
      _thickLines;
      _surfaces;
      get linesData() {
          return this._linesData;
      }
      get linesAux() {
          return this._linesAux;
      }
      get thickLines() {
          return this._thickLines;
      }
      get surfaces() {
          return this._surfaces;
      }
      _progLine;
      /**
       * log debug output
       */
      debug = false;
      /**
       * Create a webgl-plot instance
       * @param canvas - the canvas in which the plot appears
       * @param debug - (Optional) log debug messages to console
       *
       * @example
       *
       * For HTMLCanvas
       * ```typescript
       * const canvas = document.getElementbyId("canvas");
       *
       * const devicePixelRatio = window.devicePixelRatio || 1;
       * canvas.width = canvas.clientWidth * devicePixelRatio;
       * canvas.height = canvas.clientHeight * devicePixelRatio;
       *
       * const webglp = new WebGLplot(canvas);
       * ...
       * ```
       * @example
       *
       * For OffScreenCanvas
       * ```typescript
       * const offscreen = htmlCanvas.transferControlToOffscreen();
       *
       * offscreen.width = htmlCanvas.clientWidth * window.devicePixelRatio;
       * offscreen.height = htmlCanvas.clientHeight * window.devicePixelRatio;
       *
       * const worker = new Worker("offScreenCanvas.js", { type: "module" });
       * worker.postMessage({ canvas: offscreen }, [offscreen]);
       * ```
       * Then in offScreenCanvas.js
       * ```typescript
       * onmessage = function (evt) {
       * const wglp = new WebGLplot(evt.data.canvas);
       * ...
       * }
       * ```
       */
      constructor(canvas, options) {
          if (options == undefined) {
              this.webgl = canvas.getContext("webgl", {
                  antialias: true,
                  transparent: false,
              });
          }
          else {
              this.webgl = canvas.getContext("webgl", {
                  antialias: options.antialias,
                  transparent: options.transparent,
                  desynchronized: options.deSync,
                  powerPerformance: options.powerPerformance,
                  preserveDrawing: options.preserveDrawing,
              });
              this.debug = options.debug == undefined ? false : options.debug;
          }
          this.log("canvas type is: " + canvas.constructor.name);
          this.log(`[webgl-plot]:width=${canvas.width}, height=${canvas.height}`);
          this._linesData = [];
          this._linesAux = [];
          this._thickLines = [];
          this._surfaces = [];
          //this.webgl = webgl;
          this.gScaleX = 1;
          this.gScaleY = 1;
          this.gXYratio = 1;
          this.gOffsetX = 0;
          this.gOffsetY = 0;
          this.gLog10X = false;
          this.gLog10Y = false;
          // Clear the color
          this.webgl.clear(this.webgl.COLOR_BUFFER_BIT);
          // Set the view port
          this.webgl.viewport(0, 0, canvas.width, canvas.height);
          this._progLine = this.webgl.createProgram();
          this.initThinLineProgram();
          //https://learnopengl.com/Advanced-OpenGL/Blending
          this.webgl.enable(this.webgl.BLEND);
          this.webgl.blendFunc(this.webgl.SRC_ALPHA, this.webgl.ONE_MINUS_SRC_ALPHA);
      }
      /**
       * updates and redraws the content of the plot
       */
      _drawLines(lines) {
          const webgl = this.webgl;
          lines.forEach((line) => {
              if (line.visible) {
                  webgl.useProgram(this._progLine);
                  const uscale = webgl.getUniformLocation(this._progLine, "uscale");
                  webgl.uniformMatrix2fv(uscale, false, new Float32Array([
                      line.scaleX * this.gScaleX * (this.gLog10X ? 1 / Math.log(10) : 1),
                      0,
                      0,
                      line.scaleY * this.gScaleY * this.gXYratio * (this.gLog10Y ? 1 / Math.log(10) : 1),
                  ]));
                  const uoffset = webgl.getUniformLocation(this._progLine, "uoffset");
                  webgl.uniform2fv(uoffset, new Float32Array([line.offsetX + this.gOffsetX, line.offsetY + this.gOffsetY]));
                  const isLog = webgl.getUniformLocation(this._progLine, "is_log");
                  webgl.uniform2iv(isLog, new Int32Array([this.gLog10X ? 1 : 0, this.gLog10Y ? 1 : 0]));
                  const uColor = webgl.getUniformLocation(this._progLine, "uColor");
                  webgl.uniform4fv(uColor, [line.color.r, line.color.g, line.color.b, line.color.a]);
                  webgl.bufferData(webgl.ARRAY_BUFFER, line.xy, webgl.STREAM_DRAW);
                  webgl.drawArrays(line.loop ? webgl.LINE_LOOP : webgl.LINE_STRIP, 0, line.webglNumPoints);
              }
          });
      }
      _drawSurfaces(squares) {
          const webgl = this.webgl;
          squares.forEach((square) => {
              if (square.visible) {
                  webgl.useProgram(this._progLine);
                  const uscale = webgl.getUniformLocation(this._progLine, "uscale");
                  webgl.uniformMatrix2fv(uscale, false, new Float32Array([
                      square.scaleX * this.gScaleX * (this.gLog10X ? 1 / Math.log(10) : 1),
                      0,
                      0,
                      square.scaleY * this.gScaleY * this.gXYratio * (this.gLog10Y ? 1 / Math.log(10) : 1),
                  ]));
                  const uoffset = webgl.getUniformLocation(this._progLine, "uoffset");
                  webgl.uniform2fv(uoffset, new Float32Array([square.offsetX + this.gOffsetX, square.offsetY + this.gOffsetY]));
                  const isLog = webgl.getUniformLocation(this._progLine, "is_log");
                  webgl.uniform2iv(isLog, new Int32Array([this.gLog10X ? 1 : 0, this.gLog10Y ? 1 : 0]));
                  const uColor = webgl.getUniformLocation(this._progLine, "uColor");
                  webgl.uniform4fv(uColor, [square.color.r, square.color.g, square.color.b, square.color.a]);
                  webgl.bufferData(webgl.ARRAY_BUFFER, square.xy, webgl.STREAM_DRAW);
                  webgl.drawArrays(webgl.TRIANGLE_STRIP, 0, square.webglNumPoints);
              }
          });
      }
      _drawTriangles(thickLine) {
          const webgl = this.webgl;
          webgl.bufferData(webgl.ARRAY_BUFFER, thickLine.xy, webgl.STREAM_DRAW);
          webgl.useProgram(this._progLine);
          const uscale = webgl.getUniformLocation(this._progLine, "uscale");
          webgl.uniformMatrix2fv(uscale, false, new Float32Array([
              thickLine.scaleX * this.gScaleX * (this.gLog10X ? 1 / Math.log(10) : 1),
              0,
              0,
              thickLine.scaleY * this.gScaleY * this.gXYratio * (this.gLog10Y ? 1 / Math.log(10) : 1),
          ]));
          const uoffset = webgl.getUniformLocation(this._progLine, "uoffset");
          webgl.uniform2fv(uoffset, new Float32Array([thickLine.offsetX + this.gOffsetX, thickLine.offsetY + this.gOffsetY]));
          const isLog = webgl.getUniformLocation(this._progLine, "is_log");
          webgl.uniform2iv(isLog, new Int32Array([0, 0]));
          const uColor = webgl.getUniformLocation(this._progLine, "uColor");
          webgl.uniform4fv(uColor, [
              thickLine.color.r,
              thickLine.color.g,
              thickLine.color.b,
              thickLine.color.a,
          ]);
          webgl.drawArrays(webgl.TRIANGLE_STRIP, 0, thickLine.xy.length / 2);
      }
      _drawThickLines() {
          this._thickLines.forEach((thickLine) => {
              if (thickLine.visible) {
                  const calibFactor = Math.min(this.gScaleX, this.gScaleY);
                  //const calibFactor = 10;
                  //console.log(thickLine.getThickness());
                  thickLine.setActualThickness(thickLine.getThickness() / calibFactor);
                  thickLine.convertToTriPoints();
                  this._drawTriangles(thickLine);
              }
          });
      }
      /**
       * Draw and clear the canvas
       */
      update() {
          this.clear();
          this.draw();
      }
      /**
       * Draw without clearing the canvas
       */
      draw() {
          this._drawLines(this.linesData);
          this._drawLines(this.linesAux);
          this._drawThickLines();
          this._drawSurfaces(this.surfaces);
      }
      /**
       * Clear the canvas
       */
      clear() {
          //this.webgl.clearColor(0.1, 0.1, 0.1, 1.0);
          this.webgl.clear(this.webgl.COLOR_BUFFER_BIT);
      }
      /**
       * adds a line to the plot
       * @param line - this could be any of line, linestep, histogram, or polar
       *
       * @example
       * ```typescript
       * const line = new line(color, numPoints);
       * wglp.addLine(line);
       * ```
       */
      _addLine(line) {
          //line.initProgram(this.webgl);
          line._vbuffer = this.webgl.createBuffer();
          this.webgl.bindBuffer(this.webgl.ARRAY_BUFFER, line._vbuffer);
          this.webgl.bufferData(this.webgl.ARRAY_BUFFER, line.xy, this.webgl.STREAM_DRAW);
          //this.webgl.bindBuffer(this.webgl.ARRAY_BUFFER, line._vbuffer);
          line._coord = this.webgl.getAttribLocation(this._progLine, "coordinates");
          this.webgl.vertexAttribPointer(line._coord, 2, this.webgl.FLOAT, false, 0, 0);
          this.webgl.enableVertexAttribArray(line._coord);
      }
      addDataLine(line) {
          this._addLine(line);
          this.linesData.push(line);
      }
      addLine = this.addDataLine;
      addAuxLine(line) {
          this._addLine(line);
          this.linesAux.push(line);
      }
      addThickLine(thickLine) {
          this._addLine(thickLine);
          this._thickLines.push(thickLine);
      }
      addSurface(surface) {
          this._addLine(surface);
          this.surfaces.push(surface);
      }
      initThinLineProgram() {
          const vertCode = `
    attribute vec2 coordinates;
    uniform mat2 uscale;
    uniform vec2 uoffset;
    uniform ivec2 is_log;

    void main(void) {
       float x = (is_log[0]==1) ? log(coordinates.x) : coordinates.x;
       float y = (is_log[1]==1) ? log(coordinates.y) : coordinates.y;
       vec2 line = vec2(x, y);
       gl_Position = vec4(uscale*line + uoffset, 0.0, 1.0);
    }`;
          // Create a vertex shader object
          const vertShader = this.webgl.createShader(this.webgl.VERTEX_SHADER);
          // Attach vertex shader source code
          this.webgl.shaderSource(vertShader, vertCode);
          // Compile the vertex shader
          this.webgl.compileShader(vertShader);
          // Fragment shader source code
          const fragCode = `
       precision mediump float;
       uniform highp vec4 uColor;
       void main(void) {
          gl_FragColor =  uColor;
       }`;
          const fragShader = this.webgl.createShader(this.webgl.FRAGMENT_SHADER);
          this.webgl.shaderSource(fragShader, fragCode);
          this.webgl.compileShader(fragShader);
          this._progLine = this.webgl.createProgram();
          this.webgl.attachShader(this._progLine, vertShader);
          this.webgl.attachShader(this._progLine, fragShader);
          this.webgl.linkProgram(this._progLine);
      }
      /**
       * remove the last data line
       */
      popDataLine() {
          this.linesData.pop();
      }
      /**
       * remove all the lines
       */
      removeAllLines() {
          this._linesData = [];
          this._linesAux = [];
          this._thickLines = [];
          this._surfaces = [];
      }
      /**
       * remove all data lines
       */
      removeDataLines() {
          this._linesData = [];
      }
      /**
       * remove all auxiliary lines
       */
      removeAuxLines() {
          this._linesAux = [];
      }
      /**
       * Change the WbGL viewport
       * @param a
       * @param b
       * @param c
       * @param d
       */
      viewport(a, b, c, d) {
          this.webgl.viewport(a, b, c, d);
      }
      log(str) {
          if (this.debug) {
              console.log("[webgl-plot]:" + str);
          }
      }
  }

  exports.ColorRGBA = ColorRGBA;
  exports.WebglLine = WebglLine;
  exports.WebglPlot = WebglPlot;
  exports.WebglPolar = WebglPolar;
  exports.WebglSquare = WebglSquare;
  exports.WebglStep = WebglStep;
  exports.WebglThickLine = WebglThickLine;

}));
