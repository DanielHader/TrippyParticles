
const vsrc = `attribute float ratio;
varying vec3 v_position;
varying float v_ratio;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    v_position = gl_Position.xyz;
    v_ratio = ratio;
}`;

const fsrc = `varying vec3 v_position;
varying float v_ratio;
uniform float life;
uniform float rand;
uniform float time;

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float fade_inout(float t, float fi, float fo) {
    if (t > 1.0 || t < 0.0)
        return 0.0;
    if (t < fi)
        return (cos((t / fi + 1.0) * 3.14159) + 1.0) / 2.0;
    if (t > fo)
        return (cos((t - fo) / (1.0 - fo) * 3.14159) + 1.0) / 2.0;
    return 1.0;
}

float opacity(float life, float ratio) {
    float t = life * 1.5 - ratio * 0.5;
    return fade_inout(t, 0.2, 0.2);
}

float atan2(in float y, in float x)
{
    bool s = (abs(x) > abs(y));
    return mix(3.141593/2.0 - atan(x,y), atan(y,x), s);
}

void main() {
    //float angle = atan2(v_position.y, v_position.x);
    //angle /= (2.0 * 3.141592);
    float amount = 0.4;
    float offset = rand * 0.15 + time * 0.002;
    float angle = fract(v_ratio * amount + offset);
    vec3 hsv = vec3(angle, 1.0, 1.0);
    vec3 color = hsv2rgb(hsv);
    gl_FragColor = vec4(color, opacity(life, v_ratio));
}`;

const SIGMA = 10;
const BETA = 8 / 3;
const RHO = 28;

class Particle {
    constructor(pos, life, length, time) {
	this.pos = pos;
	this.life = 0;
	this.maxLife = life;
	this.length = length

	this.material = new THREE.ShaderMaterial({uniforms: {life: {value: 0}, rand: {value: Math.random()}, time: {value: time}}, vertexShader: vsrc, fragmentShader: fsrc});
	//this.material.transparent = true;
	this.material.blending = THREE.AdditiveBlending;
	//this.material.blendEquation = THREE.AddEquation;
	//this.material.blendSrc = THREE.SrcAlphaFactor;//THREE.SrcAlphaFactor;
	//this.material.blendDst = THREE.OneFactor;//THREE.DstAlphaFactor;
	//this.material = new THREE.LineBasicMaterial( {color: 0x00ff00} );
	this.geometry = new THREE.BufferGeometry();

	const positions = new Float32Array(this.length * 3);
	for (var i = 0; i < this.length; i++) {
	    positions[i * 3 + 0] = this.pos.x;
	    positions[i * 3 + 1] = this.pos.y;
	    positions[i * 3 + 2] = this.pos.z;
	}

	const ratios = new Float32Array(this.length);
	for (var i = 0; i < this.length; i++)
	    ratios[i] = i / (length - 1);
	
	this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	this.geometry.setAttribute('ratio', new THREE.BufferAttribute(ratios, 1));
	this.geometry.setDrawRange(0, this.length);

	this.line = new THREE.Line(this.geometry, this.material);
	scene.add(this.line);
    }

    update(dt) {
	this.life += 1;
	this.line.material.uniforms.life.value = this.life / this.maxLife;
	
	const vel = new THREE.Vector3;
	vel.x = SIGMA * (this.pos.y - this.pos.x);
	vel.y = this.pos.x * (RHO - this.pos.z) - this.pos.y;
	vel.z = this.pos.x * this.pos.y - BETA * this.pos.z;
	vel.multiplyScalar(dt);
	this.pos.add(vel);
	
	const positions = this.line.geometry.attributes.position.array;

	let x, y, z, index;
	x = y = z = index = 0;

	for (let i = this.length - 1; i >= 1; i--)
	{
	    positions[i * 3 + 0] = positions[(i-1) * 3 + 0];
	    positions[i * 3 + 1] = positions[(i-1) * 3 + 1];
	    positions[i * 3 + 2] = positions[(i-1) * 3 + 2];
	}

	positions[0] = this.pos.x;
	positions[1] = this.pos.y;
	positions[2] = this.pos.z;

	this.line.geometry.attributes.position.needsUpdate = true;
    }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0.0);
document.body.appendChild(renderer.domElement);

const particles = [];

let time = 0;

function animate() {
    requestAnimationFrame(animate);

    time += 1;

    if (Math.random() < 0.20)
    {
	for (var i = 0; i < Math.random() * 2; i++) {
	    const x = (Math.random() - 0.5) * 100;
	    const y = (Math.random() - 0.5) * 100;
	    const z = (Math.random() - 0.5) * 100;
	    const life = Math.floor(Math.random() * 300 + 180);
	    const length = Math.floor(Math.random() * 50 + 50);
	    particles.push(new Particle(new THREE.Vector3(x, y, z), life, length, time));
	}
    }
    
    //particles.forEach(p => p.update(0.001));
    particles.forEach(p => p.update(0.002));

    for (var i = particles.length - 1; i >= 0; i--) {
	if (particles[i].life >= particles[i].maxLife) {
	    scene.remove(particles[i].line);
	    particles.splice(i, 1);
	}
    }
    
    camera.position.x = 100 * Math.cos(time * 0.01);
    camera.position.z = 100 * Math.sin(time * 0.01);
    camera.lookAt(0, 0, 0);
    
    renderer.render(scene, camera);
}
animate();


