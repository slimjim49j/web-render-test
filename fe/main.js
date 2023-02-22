(() => {
  // fe/code/net/auth.ts
  function reqStr() {
    return Promise.reject();
  }
  function reqWasm(memory) {
    return WebAssembly.instantiateStreaming(fetch("/web-render-test/fe/assets/main.wasm"), { env: { memory } });
  }
  function reqFont() {
    return fetch("/web-render-test/fe/assets/LiberationSans-Regular.ttf").then((r) => r.arrayBuffer());
  }

  // fe/code/matrix.ts
  function createTranslateMatrix(x, y) {
    return new Float32Array([
      1,
      0,
      0,
      0,
      1,
      0,
      x,
      y,
      1
    ]);
  }
  function createScaleMatrix(x, y) {
    return new Float32Array([
      x,
      0,
      0,
      0,
      y,
      0,
      0,
      0,
      1
    ]);
  }
  function multiply(a, b) {
    var a00 = a[0 * 3 + 0];
    var a01 = a[0 * 3 + 1];
    var a02 = a[0 * 3 + 2];
    var a10 = a[1 * 3 + 0];
    var a11 = a[1 * 3 + 1];
    var a12 = a[1 * 3 + 2];
    var a20 = a[2 * 3 + 0];
    var a21 = a[2 * 3 + 1];
    var a22 = a[2 * 3 + 2];
    var b00 = b[0 * 3 + 0];
    var b01 = b[0 * 3 + 1];
    var b02 = b[0 * 3 + 2];
    var b10 = b[1 * 3 + 0];
    var b11 = b[1 * 3 + 1];
    var b12 = b[1 * 3 + 2];
    var b20 = b[2 * 3 + 0];
    var b21 = b[2 * 3 + 1];
    var b22 = b[2 * 3 + 2];
    return [
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22
    ];
  }

  // fe/code/webgl.ts
  function webGlCreateShader(gl2, type, source) {
    const shader = gl2.createShader(type);
    if (!shader) {
      throw new Error("Shader creation failed");
    }
    gl2.shaderSource(shader, source);
    gl2.compileShader(shader);
    const success = gl2.getShaderParameter(shader, gl2.COMPILE_STATUS);
    if (!success) {
      const infoLog = gl2.getShaderInfoLog(shader);
      gl2.deleteShader(shader);
      throw new Error("Shader creation failed: " + infoLog);
    }
    return shader;
  }
  function webglCreateProgram(gl2, vertexShader, fragmentShader) {
    const program = gl2.createProgram();
    if (!program) {
      throw new Error("No program");
    }
    gl2.attachShader(program, vertexShader);
    gl2.attachShader(program, fragmentShader);
    gl2.linkProgram(program);
    const success = gl2.getProgramParameter(program, gl2.LINK_STATUS);
    if (success) {
      return program;
    }
    const infoLog = gl2.getProgramInfoLog(program);
    gl2.deleteProgram(program);
    throw new Error("Program creation failed: " + infoLog);
  }

  // fe/code/webgl/webgl.ts
  function createPrograms(gl2) {
    const res = {};
    const triangleVertexSrc = `#version 300 es
    in vec2 position;
    uniform vec2 canvasResolution;
    uniform mat3 matrix;

    out vec4 color;

    vec2 convertToWebglCoords(in vec2 pixelCoord) {
        return (pixelCoord / canvasResolution * 2.0f - 1.0f) * vec2(1, -1);
    }

    void main() {
        vec2 newPosition = convertToWebglCoords((matrix * vec3(position, 1)).xy);

        gl_Position = vec4(newPosition, 0, 1);
        color = gl_Position * 0.5 + 0.5;
    }
    `;
    const triangleFragmentSrc = `#version 300 es
    precision highp float;

    in vec4 color;
    out vec4 outColor;

    void main() {
        outColor = color;
    }
    `;
    const triangleVertexShader = webGlCreateShader(gl2, gl2.VERTEX_SHADER, triangleVertexSrc);
    const triangleFragmentShader = webGlCreateShader(gl2, gl2.FRAGMENT_SHADER, triangleFragmentSrc);
    res.triangleProgram = webglCreateProgram(gl2, triangleVertexShader, triangleFragmentShader);
    const textVertexSrc = `#version 300 es
    in vec4 a_vertex_tex;

    uniform vec2 u_canvas_resolution;
    uniform mat3 u_matrix;
    
    out vec2 v_tex_coord;

    void main() {
        vec2 new_position = (u_matrix * vec3(a_vertex_tex.xy, 1)).xy;

        gl_Position = vec4((new_position / u_canvas_resolution * 2.0f - 1.0f) * vec2(1, -1), 0, 1);
        
        v_tex_coord = a_vertex_tex.zw;
    }
    `;
    const textFragmentSrc = `#version 300 es
    precision highp float;

    in vec2 v_tex_coord;
    uniform sampler2D u_texture;
    uniform vec2 texDim;

    out vec4 outColor;

    // https://gamedev.stackexchange.com/a/69604
    // https://www.shadertoy.com/view/4s3fDB
    void bilinearFilter(out vec4 fragColor, in vec2 fragCoord) {
        vec2 basis = (fragCoord * texDim) - vec2(0.5, 0.5);
        vec2 basisInt = floor(basis);
        vec2 basisFrac = fract(basis);

        vec4 a = texture(u_texture, basisInt / texDim);
        vec4 b = texture(u_texture, (basisInt + vec2(1, 0)) / texDim);
        vec4 c = texture(u_texture, (basisInt + vec2(0, 1)) / texDim);
        vec4 d = texture(u_texture, (basisInt + vec2(1, 1)) / texDim);

        fragColor = mix(
            mix(a, b, basisFrac.x),
            mix(c, d, basisFrac.x),
            basisFrac.y
        );
    }

    void main() {
        vec4 fragColor;
        bilinearFilter(fragColor, v_tex_coord);
        outColor = fragColor;
    }
    `;
    const textVertexShader = webGlCreateShader(gl2, gl2.VERTEX_SHADER, textVertexSrc);
    const textFragmentShader = webGlCreateShader(gl2, gl2.FRAGMENT_SHADER, textFragmentSrc);
    res.textProgram = webglCreateProgram(gl2, textVertexShader, textFragmentShader);
    return res;
  }
  function setupTriangleProgram(gl2, program) {
    const res = {};
    gl2.useProgram(program);
    res.canvasResolutionLoc = gl2.getUniformLocation(program, "canvasResolution");
    res.matLoc = gl2.getUniformLocation(program, "matrix");
    res.positionBuffer = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, res.positionBuffer);
    res.positionLoc = gl2.getAttribLocation(program, "position");
    res.vao = gl2.createVertexArray();
    gl2.bindVertexArray(res.vao);
    gl2.enableVertexAttribArray(res.positionLoc);
    const size = 2;
    const type = gl2.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl2.vertexAttribPointer(res.positionLoc, size, type, normalize, stride, offset);
    return res;
  }
  function setupTextProgram(gl2, program) {
    const res = {};
    gl2.useProgram(program);
    res.vertexTexBuffer = gl2.createBuffer();
    res.vao = gl2.createVertexArray();
    res.vertexTexLoc = gl2.getAttribLocation(program, "a_vertex_tex");
    gl2.bindVertexArray(res.vao);
    gl2.enableVertexAttribArray(res.vertexTexLoc);
    gl2.bindBuffer(gl2.ARRAY_BUFFER, res.vertexTexBuffer);
    gl2.vertexAttribPointer(res.vertexTexLoc, 4, gl2.FLOAT, false, 0, 0);
    res.matrixLoc = gl2.getUniformLocation(program, "u_matrix");
    res.canvasResolutionLoc = gl2.getUniformLocation(program, "u_canvas_resolution");
    res.textureLoc = gl2.getUniformLocation(program, "u_texture");
    res.textureResLoc = gl2.getUniformLocation(program, "texDim");
    return res;
  }
  function webglCreateTexture(gl2, globalPrograms2, globalTextProgramData2, texture) {
    gl2.useProgram(globalPrograms2.textProgram);
    gl2.disable(gl2.DEPTH_TEST);
    gl2.enable(gl2.BLEND);
    gl2.blendFunc(gl2.SRC_ALPHA, gl2.ONE_MINUS_SRC_ALPHA);
    globalTextProgramData2.texture = gl2.createTexture();
    gl2.activeTexture(gl2.TEXTURE0 + 0);
    gl2.bindTexture(gl2.TEXTURE_2D, globalTextProgramData2.texture);
    gl2.pixelStorei(gl2.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.ALPHA, 1024, 1024, 0, gl2.ALPHA, gl2.UNSIGNED_BYTE, texture);
    gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE);
    gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE);
    gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.NEAREST);
    gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MAG_FILTER, gl2.NEAREST);
  }
  function webglBufferTextAndCursor(gl2, triangleProgramData, textProgramData, texAndCursor) {
    const vertexAndTex = texAndCursor[0];
    const cursorView = texAndCursor[1];
    gl2.bindBuffer(gl2.ARRAY_BUFFER, textProgramData.vertexTexBuffer);
    gl2.bufferData(gl2.ARRAY_BUFFER, vertexAndTex, gl2.STATIC_DRAW);
    gl2.bindBuffer(gl2.ARRAY_BUFFER, triangleProgramData.positionBuffer);
    gl2.bufferData(gl2.ARRAY_BUFFER, cursorView, gl2.STATIC_DRAW);
  }

  // fe/code/wasm/ttf.ts
  function wasmCreateGlyphAtlas(exports, memory) {
    const bitmapReturnPointer = exports.createGlyphAtlas();
    const bitmapReturnView = new Uint32Array(memory.buffer, bitmapReturnPointer, 2);
    const bitmapView = new Uint8Array(memory.buffer, bitmapReturnView[0], bitmapReturnView[1]);
    return bitmapView;
  }
  function wasmCreateVertexAndTex(exports, memory) {
    const textReturnPointer = exports.createVertexAndTex();
    const textReturnView = new Uint32Array(memory.buffer, textReturnPointer, 5);
    const vertexAndTexView = new Float32Array(memory.buffer, textReturnView[0], textReturnView[1]);
    const cursorView = new Float32Array(memory.buffer, textReturnView[2], textReturnView[3]);
    return [vertexAndTexView, cursorView, textReturnView[4]];
  }

  // fe/code/wasm/memory.ts
  function setBuffer(memory, fontBuffer, offset) {
    const fontOffset = offset;
    const memoryView = new Uint8Array(memory.buffer, fontOffset, fontBuffer.byteLength);
    memoryView.set(fontBuffer);
    offset = memoryView.byteLength + memoryView.byteOffset;
    return offset;
  }
  function setInitialMemory(memory, fontBuffer, textBuffer) {
    const fontAddress = 16;
    const endFontAddress = setBuffer(memory, fontBuffer, fontAddress);
    const endTextAddress = setBuffer(memory, textBuffer, endFontAddress);
    const pointerInfo = new Uint32Array([fontAddress, fontBuffer.byteLength, endFontAddress, textBuffer.byteLength]);
    new Uint32Array(memory.buffer, 0, fontAddress).set(pointerInfo);
    return [fontAddress, endFontAddress, endTextAddress];
  }

  // fe/main.ts
  var gl;
  var globalPrograms;
  var globalTriangleProgramData;
  var globalTextProgramData;
  var globalTextScale = 1;
  var globalTextTranslateX = 0;
  var globalTextTranslateY = 0;
  var globalMat = multiply(createTranslateMatrix(globalTextTranslateX, globalTextTranslateY), createScaleMatrix(globalTextScale, globalTextScale));
  var globalRunning = true;
  var globalPrevTime = 0;
  var globalResizeObserver;
  var globalNeedResize = false;
  var globalCanvasWidth = 0;
  var globalCanvasHeight = 0;
  var globalInputs = {};
  var globalMemory;
  var globalExports;
  var globalTextCount;
  function resizeCanvasToDisplaySize(canvas) {
    if (globalNeedResize) {
      canvas.width = globalCanvasWidth;
      canvas.height = globalCanvasHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      globalNeedResize = false;
      const ret = wasmCreateVertexAndTex(globalExports, globalMemory);
      webglBufferTextAndCursor(gl, globalTriangleProgramData, globalTextProgramData, ret);
      globalTextCount = ret[2];
    }
  }
  function handleResize(entries) {
    const entry = entries[0];
    let width;
    let height;
    let dpr = window.devicePixelRatio;
    console.log(entries[0].devicePixelContentBoxSize[0].inlineSize, entries[0].devicePixelContentBoxSize[0].blockSize);
    const rect = entry.devicePixelContentBoxSize?.[0];
    const fallbackRect = entry.contentBoxSize?.[0] || entry.contentBoxSize;
    if (rect) {
      width = rect.inlineSize;
      height = rect.blockSize;
      dpr = 1;
    } else if (fallbackRect) {
      width = fallbackRect.inlineSize;
      height = fallbackRect.blockSize;
    } else {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
    }
    globalCanvasWidth = Math.round(width * dpr);
    globalCanvasHeight = Math.round(height * dpr);
    globalNeedResize = true;
  }
  var textEncoder = new TextEncoder();
  function handleKeyDown(e) {
    const key = e.key;
    globalInputs[key] = true;
    console.log("down", key);
    let char;
    if (key) {
      if (key.length === 1) {
        char = textEncoder.encode(key);
        console.log(char);
      } else {
        switch (key) {
          case "Enter":
            {
              char = 10;
            }
            break;
          case "Backspace":
            {
              char = (226 << 16) + (140 << 8) + 171;
            }
            break;
          case "Delete":
            {
              char = (226 << 16) + (140 << 8) + 166;
            }
            break;
          case "ArrowUp":
            {
              char = (226 << 16) + (134 << 8) + 145;
            }
            break;
          case "ArrowRight":
            {
              char = (226 << 16) + (134 << 8) + 146;
            }
            break;
          case "ArrowDown":
            {
              char = (226 << 16) + (134 << 8) + 147;
            }
            break;
          case "ArrowLeft":
            {
              char = (226 << 16) + (134 << 8) + 144;
            }
            break;
        }
      }
    }
    if (char) {
      globalExports.addChar(char);
      const ret = wasmCreateVertexAndTex(globalExports, globalMemory);
      globalTextCount = ret[2];
      webglBufferTextAndCursor(gl, globalTriangleProgramData, globalTextProgramData, ret);
    }
  }
  function handleKeyUp(e) {
    globalInputs[e.key] = false;
    console.log("up", e.key);
  }
  function handleUnload() {
    globalResizeObserver.disconnect();
  }
  function loop(time) {
    const elapsedTime = time - globalPrevTime;
    resizeCanvasToDisplaySize(gl.canvas);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    {
      gl.useProgram(globalPrograms.triangleProgram);
      gl.bindVertexArray(globalTriangleProgramData.vao);
      gl.uniform2f(globalTriangleProgramData.canvasResolutionLoc, gl.canvas.width, gl.canvas.height);
      gl.uniformMatrix3fv(globalTriangleProgramData.matLoc, false, globalMat);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    {
      gl.useProgram(globalPrograms.textProgram);
      gl.bindVertexArray(globalTextProgramData.vao);
      gl.uniform2f(globalTextProgramData.canvasResolutionLoc, gl.canvas.width, gl.canvas.height);
      gl.uniformMatrix3fv(globalTextProgramData.matrixLoc, false, globalMat);
      gl.uniform1i(globalTextProgramData.textureLoc, 0);
      gl.uniform2f(globalTextProgramData.textureResLoc, 1024, 1024);
      const numPoints = globalTextCount * 6;
      gl.drawArrays(gl.TRIANGLES, 0, numPoints);
    }
    globalPrevTime = time;
    if (globalRunning) {
      window.requestAnimationFrame(loop);
    }
  }
  function createWebgl() {
    const canvas = document.body.appendChild(document.createElement("CANVAS"));
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    globalCanvasWidth = canvas.clientWidth;
    globalCanvasHeight = canvas.clientHeight;
    if (!globalCanvasWidth)
      throw "The canvas has no width";
    const gl2 = canvas.getContext("webgl2", {
      antialias: false,
      preserveDrawingBuffer: true
    });
    return gl2;
  }
  function main() {
    const mem = new WebAssembly.Memory({ initial: 200 });
    Promise.allSettled([
      reqStr(),
      reqWasm(mem),
      reqFont()
    ]).then(([strRes, wasmRes, fontRes]) => {
      const fontBuffer = new Uint8Array(fontRes.value);
      let str = `Hello! This is a prototype text editor built in C++ compiled to WASM and hardware
accelerated by WebGL.

This project focuses on using a very minimal set of dependencies to achieve the output.
Use arrow keys and scroll to navigate.

Completed:
 * better glyphs (with stb_truetype and wasi-libc)
 * wasm integration
 * enabled subpixel oversampling + font kerning
 * bilinear interpolation
 * basic scrolling
 * basic text cursor
 
Todo:
 * mouse interaction
 * cursor highlight
 * expanded unicode support`;
      if (strRes.status === "fulfilled") {
        str = strRes.value;
      } else {
        console.log("caught");
      }
      const textBuffer = new TextEncoder().encode(str);
      setInitialMemory(mem, fontBuffer, textBuffer);
      globalMemory = mem;
      globalExports = wasmRes.value.instance.exports;
      globalExports._initialize();
      const bitmapTexture = wasmCreateGlyphAtlas(globalExports, globalMemory);
      webglCreateTexture(gl, globalPrograms, globalTextProgramData, bitmapTexture);
      const ret = wasmCreateVertexAndTex(globalExports, globalMemory);
      globalTextCount = ret[2];
      webglBufferTextAndCursor(gl, globalTriangleProgramData, globalTextProgramData, ret);
      window.requestAnimationFrame(loop);
    });
    gl = createWebgl();
    globalPrograms = createPrograms(gl);
    globalTriangleProgramData = setupTriangleProgram(gl, globalPrograms.triangleProgram);
    globalTextProgramData = setupTextProgram(gl, globalPrograms.textProgram);
    globalResizeObserver = new ResizeObserver(handleResize);
    globalResizeObserver.observe(gl.canvas, { box: "content-box" });
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("wheel", (e) => {
      const dx = e.deltaX;
      const dy = e.deltaY;
      const dirX = dx / (Math.abs(dx) || 1);
      const dirY = dy / (Math.abs(dy) || 1);
      if (globalInputs["Shift"]) {
        globalTextTranslateX += dirY * 10;
        globalTextTranslateY += dirX * 10;
      } else {
        globalTextTranslateX += dirX * 10;
        globalTextTranslateY += dirY * 10;
      }
      globalMat = createTranslateMatrix(globalTextTranslateX, globalTextTranslateY);
    });
  }
  main();
})();
