import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/controls/OrbitControls.js';

// ---- Scene setup ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f14);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(10, 12, 14);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.5, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(6,12,8);
    scene.add(dir);

    // floor
    const grid = new THREE.GridHelper(30,30,0x223344,0x16212e);
    scene.add(grid);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.MeshStandardMaterial({color:0x0e131a}));
    plane.rotation.x = -Math.PI/2; plane.name="floor"; scene.add(plane);

    // pivot + bob
    const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.08,16,16), new THREE.MeshBasicMaterial({color:0x9ed0ff}));
    pivot.position.set(0,6,0); scene.add(pivot);

    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.25,32,32), new THREE.MeshStandardMaterial({color:0x00d2ff}));
    scene.add(bob);
    const cable = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color:0x6eaad6}));
    scene.add(cable);

    // magnets as flat cylinders
    const attractorGroup = new THREE.Group(); scene.add(attractorGroup);
    let attractors=[];
    function makeMagnet(x,z){
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25,0.25,0.2,20), // flacher Zylinder
        new THREE.MeshStandardMaterial({color:0xff7a00})
      );
      m.rotation.x = 0;      // flach
      m.rotation.z = 0;      // flach
      m.position.set(x,0,z);
      return m;
    }

	// Trail Canvas erstellen und hinzufügen
	const trailCanvas = document.createElement('canvas');
	trailCanvas.id = 'trailCanvas';
	trailCanvas.style.position = 'absolute';
	trailCanvas.style.top = '0';
	trailCanvas.style.left = '0';
	trailCanvas.style.pointerEvents = 'none';
	trailCanvas.style.zIndex = '1';
	document.body.appendChild(trailCanvas);

	// Spur-Canvas Setup
	trailCanvas.width = window.innerWidth;
	trailCanvas.height = window.innerHeight;
	const trailCtx = trailCanvas.getContext('2d');
	let trailEnabled = false;

	// Trail-Daten
	const trailPoints = [];
	const maxTrailPoints = 3500;

	// Spur ein/aus Button
	document.getElementById('toggleTrail').onclick = () => {
	  trailEnabled = !trailEnabled;
	  if (!trailEnabled) {
		trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
		trailPoints.length = 0;
	  }
	};

// Spur zeichnen
	function drawTrail() {
	  if (!trailEnabled) return;
  
	  // Canvas an Fenstergröße anpassen
	  if (trailCanvas.width !== window.innerWidth || trailCanvas.height !== window.innerHeight) {
		trailCanvas.width = window.innerWidth;
		trailCanvas.height = window.innerHeight;
	  }
  
	  // Position des Pendels in Bildschirmkoordinaten umrechnen
	  const bobPosition = bob.position.clone();
	  bobPosition.project(camera);
	  const x = (bobPosition.x * 0.5 + 0.5) * trailCanvas.width;
	  const y = (-(bobPosition.y * 0.5) + 0.5) * trailCanvas.height;
  
	  // Punkt zur Spur hinzufügen
	  trailPoints.push({x, y});
	  if (trailPoints.length > maxTrailPoints) {
		trailPoints.shift();
	  }
  

	  trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
	  trailCtx.globalCompositeOperation = 'lighter';
	  trailCtx.lineWidth = 2;
	  trailCtx.beginPath();
  
	  for (let i = 0; i < trailPoints.length; i++) {
		const point = trailPoints[i];
		const alpha = i / trailPoints.length;
	
		if (i === 0) {
		  trailCtx.moveTo(point.x, point.y);
		} else {
		  trailCtx.lineTo(point.x, point.y);
		}
	
		// Farbverlauf von blau nach weiß
		const hue = 200 + alpha * 100; // Blau zu hellblau
		trailCtx.strokeStyle = `hsla(${hue}, 100%, 70%, ${alpha*0.7})`;
		trailCtx.stroke();
		trailCtx.beginPath();
		trailCtx.moveTo(point.x, point.y);
	  }
	}

    const maxPendulumLength = 15; // maximale Länge zwischen Pivot und Bob

    function placeAttractors(n){
      attractorGroup.clear(); attractors=[];
      const r = parseFloat(document.getElementById("magRadius").value); // <-- Sliderwert
      for(let i=0;i<n;i++){
        const a=i*2*Math.PI/n; 
        const x=r*Math.cos(a), z=r*Math.sin(a);
        attractors.push({x,z,s:1});
        attractorGroup.add(makeMagnet(x,z));
      }
    }
    placeAttractors(3);

	document.getElementById("toggleControls").onclick = () => {
	  const panel = document.getElementById("controlsPanel");
	  panel.style.display = (panel.style.display === "none") ? "block" : "none";
	};

    // physics
    const state={pos:new THREE.Vector2(0.01,0),vel:new THREE.Vector2(),damping:0.12,kRest:0.35,strength:2.2,power:3,dt:1/120,speed:1};
    function accel(p){
      const a=new THREE.Vector2(-state.kRest*p.x,-state.kRest*p.y);
      attractors.forEach(M=>{
        const dx=M.x-p.x, dz=M.z-p.y;
        const d2=dx*dx+dz*dz+0.01;
        const f=state.strength/Math.pow(d2,state.power/2);
        a.x+=f*dx; a.y+=f*dz;
      });
      a.x+=-state.damping*state.vel.x; a.y+=-state.damping*state.vel.y;
      return a;
    }
    function step(){
      const a=accel(state.pos);
      state.vel.addScaledVector(a,state.dt*state.speed);
      state.pos.addScaledVector(state.vel,state.dt*state.speed);

	  // ----- Pendellängenbegrenzung -----
	  const length = state.pos.length(); // Abstand vom Pivot
	  if(length > maxPendulumLength){
		state.pos.multiplyScalar(maxPendulumLength / length); // Länge begrenzen
		state.vel.set(0,0); // optional: Geschwindigkeit zurücksetzen
	  }
    }
    function sync(){
      bob.position.set(state.pos.x,0.4,state.pos.y);
      cable.geometry.setFromPoints([pivot.position.clone(),bob.position.clone()]);
    }

    // kick on click
    const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
    renderer.domElement.addEventListener("pointerdown",e=>{
      mouse.x=(e.clientX/window.innerWidth)*2-1;
      mouse.y=-(e.clientY/window.innerHeight)*2+1;
      raycaster.setFromCamera(mouse,camera);
      const hit=raycaster.intersectObject(plane)[0];
      if(hit){
        const to=new THREE.Vector2(hit.point.x-state.pos.x,hit.point.z-state.pos.y).normalize();
        state.vel.addScaledVector(to,3);
      }
    });

    // UI hooks
    const $=id=>document.getElementById(id);
    $("magCount").onchange=()=>placeAttractors(parseInt($("magCount").value));
    $("strength").oninput=()=>state.strength=parseFloat($("strength").value);
    $("damping").oninput=()=>state.damping=parseFloat($("damping").value);
    $("restoring").oninput=()=>state.kRest=parseFloat($("restoring").value);
    $("power").oninput=()=>state.power=parseFloat($("power").value);
    $("speed").oninput=()=>state.speed=parseFloat($("speed").value);
    $("center").onclick=()=>{state.pos.set(0,0); state.vel.set(0,0);};
    // $ Konstante funktioniert offensichtlich nicht mit einer Funktion
    document.getElementById("magRadius").oninput = function(){
      placeAttractors(parseInt(document.getElementById("magCount").value));
    };

    // animate
    function animate(){
      step(); sync();

    drawTrail();

      controls.update(); renderer.render(scene,camera);
      requestAnimationFrame(animate);
    }
    animate();

    // resize
	window.addEventListener('resize', ()=>{
	  camera.aspect = innerWidth/innerHeight;
	  camera.updateProjectionMatrix();
	  renderer.setSize(innerWidth, innerHeight);
	  trailCanvas.width = innerWidth;
	  trailCanvas.height = innerHeight;
	});

	renderer.domElement.addEventListener('pointerdown', () => {
	  if (trailEnabled) {
		trailEnabled = false;
		trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
		trailPoints.length = 0;
	  }
	});
