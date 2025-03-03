/* eslint-disable */
/**
 * RGB Shift Shader
 * Shifts red and blue channels from center in opposite directions
 * Ported from http://kriss.cx/tom/2009/05/rgb-shift/
 * by Tom Butterworth / http://kriss.cx/tom/
 *
 * amount: shift distance (1 is width of input)
 * angle: shift angle in radians
 */
const twgl = require('twgl.js');
const GandiShader = require('./GandiShader');

const {DataTexture, FloatType, MathUtils, RedFormat} = require('three');

class GandiGlitch extends GandiShader {
    constructor(gl, bufferInfo, render) {
        super(gl, bufferInfo, render, GandiGlitch.vertexShader, GandiGlitch.fragmentShader);
        this.uniforms = GandiGlitch.uniforms;
        this._duration = 0;
        this.options = {
            amount: 100.0,
            distortion: 1.0,
        };
    }

    set duration (d = 10) {
        this._duration = d;
        this.dirty = true;
        this._render.peDirty = true;
    }

    get duration () {
        return this._duration;
    }

    static get uniforms () {
        return {
            // tDiffuse: 0, // diffuse texture
            // tDisp: 0, // displacement texture for digital glitch squares
            byp: 0, // apply the glitch ?
            amount: 0.08,
            angle: 0.02,
            seed: 0.02,
            seed_x: 0.02, // -1,1
            seed_y: 0.02, // -1,1
            distortion_x: 0.5,
            distortion_y: 0.6,
            col_s: 0.05
        };
    }

    static get vertexShader () {
        return /* glsl */`
		varying vec2 vUv;
		attribute vec2 a_position;
		attribute vec2 uv;
		attribute vec2 a_texCoord;
        void main() {
            vUv = uv;
            vec2 fixedPosition = a_position;
            fixedPosition.y = -fixedPosition.y;
            gl_Position = vec4(-fixedPosition * 2.0, 0.0, 1.0);
          }`;
    }

    static get fragmentShader () {
        return /* glsl */`
		#ifdef GL_ES
precision mediump float;
#endif
		uniform int byp; //should we apply the glitch ?
		uniform sampler2D tDiffuse;
		uniform sampler2D tDisp;
		uniform float amount;
		uniform float angle;
		uniform float seed;
		uniform float seed_x;
		uniform float seed_y;
		uniform float distortion_x;
		uniform float distortion_y;
		uniform float col_s;
		varying vec2 vUv;
		float rand(vec2 co){
			return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
		}
		void main() {
			if(byp<1) {
				vec2 p = vUv;
				float xs = floor(gl_FragCoord.x / 0.5);
				float ys = floor(gl_FragCoord.y / 0.5);
				float disp = texture2D(tDisp, p*seed*seed).r;
				if(p.y<distortion_x+col_s && p.y>distortion_x-col_s*seed) {
					if(seed_x>0.){
						p.y = 1. - (p.y + distortion_y);
					}
					else {
						p.y = distortion_y;
					}
				}
				if(p.x<distortion_y+col_s && p.x>distortion_y-col_s*seed) {
					if(seed_y>0.){
						p.x=distortion_x;
					}
					else {
						p.x = 1. - (p.x + distortion_x);
					}
				}
				p.x+=disp*seed_x*(seed/5.);
				p.y+=disp*seed_y*(seed/5.);
				//base from RGB shift shader
				vec2 offset = amount * vec2( cos(angle), sin(angle));
				vec4 cr = texture2D(tDiffuse, p + offset);
				vec4 cga = texture2D(tDiffuse, p);
				vec4 cb = texture2D(tDiffuse, p - offset);
				gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
				//add noise
				vec4 snow = 200.*amount*vec4(rand(vec2(xs * seed,ys * seed*50.))*0.2);
				gl_FragColor = gl_FragColor+ snow;
			}
			else {
				gl_FragColor=texture2D (tDiffuse, vUv);
			}
		}`;
    }

    generateHeightmap (dtSize) {

        const dataArr = new Float32Array(dtSize * dtSize);
        const length = dtSize * dtSize;
        for (let i = 0; i < length; i++) {

            const val = MathUtils.randFloat(0, 1);
            dataArr[i] = val;

        }

        const texture = new DataTexture(dataArr, dtSize, dtSize, RedFormat, FloatType);
        texture.needsUpdate = true;
        return texture;
    }

    render () {
        if (this.bypass > 0 || !this.trySetupProgram()) {
            return false;
        }
        this._duration--;
        if (this._duration < 0) {
            this.dirty = false;
            return false;
        }
        const heightMap = this.generateHeightmap(64);
        const texture = twgl.createTexture(this._gl, {
            src: heightMap.image.data
        });
        twgl.setUniforms(this._program, {
            byp: this.bypass,
            tDisp: texture || 0,
            tDiffuse: this._render.fbo.attachments[0],
            amount: Math.random() / this.options.amount,
            seed_x: MathUtils.randFloat(-1, 1),
            seed_y: MathUtils.randFloat(-1, 1),
            distortion_x: MathUtils.randFloat(0, this.options.distortion),
            distortion_y: MathUtils.randFloat(0, this.options.distortion),
            angle: MathUtils.randFloat(-Math.PI, Math.PI)
        });
        twgl.drawBufferInfo(this._gl, this._bufferInfo);
        this._gl.deleteTexture(texture);
        this.dirty = true;
        return true;
    }

}
module.exports = GandiGlitch;
