/**
 * WebGL2 compositor for editly-web
 * Handles frame composition, resize modes, gradients, and overlays
 */

import type { ResizeMode } from "../editly/types.ts";

export interface DrawOptions {
  resizeMode?: ResizeMode;
  opacity?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface ShaderProgram {
  program: WebGLProgram;
  locations: {
    position: number;
    texCoord: number;
    texture: WebGLUniformLocation;
    opacity: WebGLUniformLocation;
  };
}

interface GradientProgram {
  program: WebGLProgram;
  locations: {
    position: number;
    color1: WebGLUniformLocation;
    color2: WebGLUniformLocation;
    gradientType: WebGLUniformLocation;
  };
}

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_texture;
uniform float u_opacity;

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  fragColor = vec4(color.rgb, color.a * u_opacity);
}
`;

const GRADIENT_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_position = a_position * 0.5 + 0.5; // Convert from [-1,1] to [0,1]
}
`;

const GRADIENT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_position;
out vec4 fragColor;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform int u_gradientType; // 0 = linear, 1 = radial

void main() {
  float t;
  if (u_gradientType == 1) {
    // Radial gradient from center
    vec2 center = vec2(0.5, 0.5);
    t = distance(v_position, center) * 2.0;
    t = clamp(t, 0.0, 1.0);
  } else {
    // Linear gradient from top-left to bottom-right
    t = (v_position.x + v_position.y) / 2.0;
  }
  fragColor = mix(u_color1, u_color2, t);
}
`;

export class WebGLCompositor {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
  width: number;
  height: number;

  private textureProgram: ShaderProgram;
  private gradientProgram: GradientProgram;
  private quadBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = new OffscreenCanvas(width, height);

    const gl = this.canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      throw new Error("WebGL2 not supported");
    }
    this.gl = gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.textureProgram = this.createTextureProgram();
    this.gradientProgram = this.createGradientProgram();

    this.quadBuffer = this.createBuffer(
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    );
    this.texCoordBuffer = this.createBuffer(
      new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
    );
  }

  private compileShader(type: number, source: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${info}`);
    }
    return shader;
  }

  private createProgram(vertexSrc: string, fragmentSrc: string): WebGLProgram {
    const { gl } = this;
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSrc);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSrc);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw new Error(`Program linking failed: ${info}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  private createTextureProgram(): ShaderProgram {
    const { gl } = this;
    const program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    return {
      program,
      locations: {
        position: gl.getAttribLocation(program, "a_position"),
        texCoord: gl.getAttribLocation(program, "a_texCoord"),
        texture: gl.getUniformLocation(program, "u_texture")!,
        opacity: gl.getUniformLocation(program, "u_opacity")!,
      },
    };
  }

  private createGradientProgram(): GradientProgram {
    const { gl } = this;
    const program = this.createProgram(
      GRADIENT_VERTEX_SHADER,
      GRADIENT_FRAGMENT_SHADER,
    );
    return {
      program,
      locations: {
        position: gl.getAttribLocation(program, "a_position"),
        color1: gl.getUniformLocation(program, "u_color1")!,
        color2: gl.getUniformLocation(program, "u_color2")!,
        gradientType: gl.getUniformLocation(program, "u_gradientType")!,
      },
    };
  }

  private createBuffer(data: Float32Array): WebGLBuffer {
    const { gl } = this;
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  }

  private parseColor(color: string): [number, number, number, number] {
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0]! + hex[0]!, 16) / 255;
        const g = parseInt(hex[1]! + hex[1]!, 16) / 255;
        const b = parseInt(hex[2]! + hex[2]!, 16) / 255;
        return [r, g, b, 1];
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return [r, g, b, 1];
      }
      if (hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        const a = parseInt(hex.slice(6, 8), 16) / 255;
        return [r, g, b, a];
      }
    }
    return [0, 0, 0, 1];
  }

  clear(color: string = "#000000"): void {
    const { gl } = this;
    const [r, g, b, a] = this.parseColor(color);
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  drawGradient(type: "linear" | "radial", colors: [string, string]): void {
    const { gl } = this;
    const { program, locations } = this.gradientProgram;

    gl.useProgram(program);

    const color1 = this.parseColor(colors[0]);
    const color2 = this.parseColor(colors[1]);
    gl.uniform4fv(locations.color1, color1);
    gl.uniform4fv(locations.color2, color2);
    gl.uniform1i(locations.gradientType, type === "radial" ? 1 : 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 4, 4);
  }

  drawFrame(frame: VideoFrame | ImageBitmap, options: DrawOptions = {}): void {
    const { gl } = this;
    const { program, locations } = this.textureProgram;
    const { resizeMode = "contain-blur", opacity = 1 } = options;

    gl.useProgram(program);

    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);

    const srcWidth =
      frame instanceof VideoFrame ? frame.displayWidth : frame.width;
    const srcHeight =
      frame instanceof VideoFrame ? frame.displayHeight : frame.height;
    const srcAspect = srcWidth / srcHeight;
    const dstAspect = this.width / this.height;

    let positions: Float32Array;
    let texCoords: Float32Array;

    if (resizeMode === "contain-blur") {
      this.drawBlurredBackground(frame, srcAspect, dstAspect);
    }

    if (resizeMode === "stretch") {
      positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
    } else if (resizeMode === "cover") {
      positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

      if (srcAspect > dstAspect) {
        const cropWidth = dstAspect / srcAspect;
        const offset = (1 - cropWidth) / 2;
        texCoords = new Float32Array([
          offset,
          1,
          offset + cropWidth,
          1,
          offset,
          0,
          offset + cropWidth,
          0,
        ]);
      } else {
        const cropHeight = srcAspect / dstAspect;
        const offset = (1 - cropHeight) / 2;
        texCoords = new Float32Array([
          0,
          offset + cropHeight,
          1,
          offset + cropHeight,
          0,
          offset,
          1,
          offset,
        ]);
      }
    } else {
      texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);

      if (srcAspect > dstAspect) {
        const scale = dstAspect / srcAspect;
        positions = new Float32Array([
          -1,
          -scale,
          1,
          -scale,
          -1,
          scale,
          1,
          scale,
        ]);
      } else {
        const scale = srcAspect / dstAspect;
        positions = new Float32Array([
          -scale,
          -1,
          scale,
          -1,
          -scale,
          1,
          scale,
          1,
        ]);
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.texCoord);
    gl.vertexAttribPointer(locations.texCoord, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(locations.texture, 0);
    gl.uniform1f(locations.opacity, opacity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.deleteTexture(texture);
  }

  private drawBlurredBackground(
    frame: VideoFrame | ImageBitmap,
    srcAspect: number,
    dstAspect: number,
  ): void {
    const { gl } = this;
    const { program, locations } = this.textureProgram;

    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    let texCoords: Float32Array;

    if (srcAspect > dstAspect) {
      const cropWidth = dstAspect / srcAspect;
      const offset = (1 - cropWidth) / 2;
      texCoords = new Float32Array([
        offset,
        1,
        offset + cropWidth,
        1,
        offset,
        0,
        offset + cropWidth,
        0,
      ]);
    } else {
      const cropHeight = srcAspect / dstAspect;
      const offset = (1 - cropHeight) / 2;
      texCoords = new Float32Array([
        0,
        offset + cropHeight,
        1,
        offset + cropHeight,
        0,
        offset,
        1,
        offset,
      ]);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.texCoord);
    gl.vertexAttribPointer(locations.texCoord, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(locations.texture, 0);
    gl.uniform1f(locations.opacity, 0.3);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.deleteTexture(texture);
  }

  drawOverlay(
    frame: VideoFrame | ImageBitmap,
    x: number,
    y: number,
    width: number,
    height: number,
    opacity: number = 1,
  ): void {
    const { gl } = this;
    const { program, locations } = this.textureProgram;

    gl.useProgram(program);

    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);

    const x1 = (x / this.width) * 2 - 1;
    const y1 = 1 - ((y + height) / this.height) * 2;
    const x2 = ((x + width) / this.width) * 2 - 1;
    const y2 = 1 - (y / this.height) * 2;

    const positions = new Float32Array([x1, y1, x2, y1, x1, y2, x2, y2]);
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.texCoord);
    gl.vertexAttribPointer(locations.texCoord, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(locations.texture, 0);
    gl.uniform1f(locations.opacity, opacity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.deleteTexture(texture);
  }

  getFrame(): VideoFrame {
    return new VideoFrame(this.canvas, {
      timestamp: 0,
    });
  }

  getImageBitmap(): Promise<ImageBitmap> {
    return createImageBitmap(this.canvas);
  }

  destroy(): void {
    const { gl } = this;
    gl.deleteProgram(this.textureProgram.program);
    gl.deleteProgram(this.gradientProgram.program);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
  }
}
