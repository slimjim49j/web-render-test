(() => {
  // code/matrix.ts
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

  // code/webgl.ts
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

  // main.ts
  var gl;
  var globalPrograms;
  var globalTriangleProgramData;
  var globalTextProgramData;
  var globalImage;
  var globalStrVerticesData;
  var globalTextScale = 4;
  var globalTextTranslate = 100;
  var globalMat = multiply(createTranslateMatrix(globalTextTranslate, globalTextTranslate), createScaleMatrix(globalTextScale, globalTextScale));
  var globalRunning = true;
  var globalPrevTime = 0;
  var globalResizeObserver;
  var globalNeedResize = false;
  var globalCanvasWidth = 0;
  var globalCanvasHeight = 0;
  var globalStr = "Hello world";
  var globalInputs = {};
  function createPrograms() {
    const res = {};
    const triangleVertexSrc = `#version 300 es
    in vec2 a_position;
    uniform vec2 u_canvas_resolution;
    uniform mat3 u_translation_mat;
    out vec4 v_color;

    void main() {
        vec2 new_position = (u_translation_mat * vec3(a_position, 1)).xy;
        // gl_Position is a special var
        gl_Position = vec4((new_position / u_canvas_resolution * 2.0f - 1.0f) * vec2(1, -1), 0, 1);
        v_color = gl_Position * 0.5 + 0.5;
    }
    `;
    const triangleFragmentSrc = `#version 300 es
    // set default precision
    precision highp float;

    in vec4 v_color;
    // output of fragment shader
    out vec4 outColor;

    void main() {
        // output color is always red-purple
        outColor = v_color;
    }
    `;
    const triangleVertexShader = webGlCreateShader(gl, gl.VERTEX_SHADER, triangleVertexSrc);
    const triangleFragmentShader = webGlCreateShader(gl, gl.FRAGMENT_SHADER, triangleFragmentSrc);
    res.triangleProgram = webglCreateProgram(gl, triangleVertexShader, triangleFragmentShader);
    const textVertexSrc = `#version 300 es
    in vec2 a_position;
    in vec2 a_tex_coord;

    uniform vec2 u_canvas_resolution;
    uniform mat3 u_matrix;
    
    out vec2 v_tex_coord;

    void main() {
        vec2 new_position = (u_matrix * vec3(a_position, 1)).xy;
        // vec2 new_position = (a_position + vec2(50, 50)) * vec2(10, 10);
        // gl_Position is a special var
        gl_Position = vec4((new_position / u_canvas_resolution * 2.0f - 1.0f) * vec2(1, -1), 0, 1);
        
        v_tex_coord = a_tex_coord;
    }
    `;
    const textFragmentSrc = `#version 300 es
    precision highp float;

    in vec2 v_tex_coord;
    uniform sampler2D u_texture;

    out vec4 outColor;

    void main() {
        outColor = texture(u_texture, v_tex_coord);
    }
    `;
    const textVertexShader = webGlCreateShader(gl, gl.VERTEX_SHADER, textVertexSrc);
    const textFragmentShader = webGlCreateShader(gl, gl.FRAGMENT_SHADER, textFragmentSrc);
    res.textProgram = webglCreateProgram(gl, textVertexShader, textFragmentShader);
    return res;
  }
  function setupTriangleProgram(program) {
    const res = {};
    gl.useProgram(program);
    res.canvasResolutionLoc = gl.getUniformLocation(program, "u_canvas_resolution");
    res.translationMatLoc = gl.getUniformLocation(program, "u_translation_mat");
    res.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, res.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0,
      0,
      0,
      1e3,
      700,
      1e3,
      300,
      0,
      300,
      100,
      200,
      0
    ]), gl.STATIC_DRAW);
    const positionAttrLocation = gl.getAttribLocation(program, "a_position");
    res.positionVao = gl.createVertexArray();
    gl.bindVertexArray(res.positionVao);
    gl.enableVertexAttribArray(positionAttrLocation);
    const size = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.vertexAttribPointer(positionAttrLocation, size, type, normalize, stride, offset);
    return res;
  }
  function setupTextProgram(program) {
    const res = {};
    gl.useProgram(program);
    res.positionBuffer = gl.createBuffer();
    res.coordBuffer = gl.createBuffer();
    res.matrixLoc = gl.getUniformLocation(program, "u_matrix");
    res.canvasResolutionLoc = gl.getUniformLocation(program, "u_canvas_resolution");
    res.textureLoc = gl.getUniformLocation(program, "u_texture");
    return res;
  }
  function resizeCanvasToDisplaySize(canvas) {
    if (globalNeedResize) {
      canvas.width = globalCanvasWidth;
      canvas.height = globalCanvasHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      globalNeedResize = false;
      globalStrVerticesData = createStringVertices(globalStr, globalFontInfo);
      gl.useProgram(globalPrograms.textProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.vertices, gl.STATIC_DRAW);
      gl.useProgram(globalPrograms.textProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.coordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.textureCoords, gl.STATIC_DRAW);
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
  function handleKeyDown(e) {
    const key = e.key;
    globalInputs[key] = true;
    console.log("down", key);
    if (key.length === 1) {
      globalStr += key === "\\" ? "\\\\" : e.key;
    } else {
      switch (key) {
        case "Backspace":
          {
            globalStr = globalStr.slice(0, globalStr.length - 1);
          }
          break;
        case "Enter":
          {
            globalStr += "\n";
          }
          break;
      }
    }
    globalStrVerticesData = createStringVertices(globalStr, globalFontInfo);
    gl.useProgram(globalPrograms.textProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.vertices, gl.STATIC_DRAW);
    gl.useProgram(globalPrograms.textProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.coordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.textureCoords, gl.STATIC_DRAW);
  }
  function handleKeyUp(e) {
    globalInputs[e.key] = false;
    console.log("up", e.key);
  }
  function handleUnload() {
    globalResizeObserver.disconnect();
  }
  var globalFontInfo = {
    letterHeight: 8,
    spaceWidth: 4,
    spacing: -1,
    textureWidth: 64,
    textureHeight: 40,
    glyphInfos: {
      "a": { x: 0, y: 0, width: 8 },
      "b": { x: 8, y: 0, width: 8 },
      "c": { x: 16, y: 0, width: 8 },
      "d": { x: 24, y: 0, width: 8 },
      "e": { x: 32, y: 0, width: 8 },
      "f": { x: 40, y: 0, width: 8 },
      "g": { x: 48, y: 0, width: 8 },
      "h": { x: 56, y: 0, width: 8 },
      "i": { x: 0, y: 8, width: 8 },
      "j": { x: 8, y: 8, width: 8 },
      "k": { x: 16, y: 8, width: 8 },
      "l": { x: 24, y: 8, width: 8 },
      "m": { x: 32, y: 8, width: 8 },
      "n": { x: 40, y: 8, width: 8 },
      "o": { x: 48, y: 8, width: 8 },
      "p": { x: 56, y: 8, width: 8 },
      "q": { x: 0, y: 16, width: 8 },
      "r": { x: 8, y: 16, width: 8 },
      "s": { x: 16, y: 16, width: 8 },
      "t": { x: 24, y: 16, width: 8 },
      "u": { x: 32, y: 16, width: 8 },
      "v": { x: 40, y: 16, width: 8 },
      "w": { x: 48, y: 16, width: 8 },
      "x": { x: 56, y: 16, width: 8 },
      "y": { x: 0, y: 24, width: 8 },
      "z": { x: 8, y: 24, width: 8 },
      "0": { x: 16, y: 24, width: 8 },
      "1": { x: 24, y: 24, width: 8 },
      "2": { x: 32, y: 24, width: 8 },
      "3": { x: 40, y: 24, width: 8 },
      "4": { x: 48, y: 24, width: 8 },
      "5": { x: 56, y: 24, width: 8 },
      "6": { x: 0, y: 32, width: 8 },
      "7": { x: 8, y: 32, width: 8 },
      "8": { x: 16, y: 32, width: 8 },
      "9": { x: 24, y: 32, width: 8 },
      "-": { x: 32, y: 32, width: 8 },
      "*": { x: 40, y: 32, width: 8 },
      "!": { x: 48, y: 32, width: 8 },
      "?": { x: 56, y: 32, width: 8 }
    }
  };
  function createStringVertices(str, fontInfo) {
    str = str.toLowerCase();
    const verticesArrLength = str.length * 6 * 2;
    const vertices = new Float32Array(verticesArrLength);
    const textureCoords = new Float32Array(verticesArrLength);
    let runningVerticesIndex = 0;
    let left = 0;
    let top = 0;
    let effectiveCanvasWidth = globalCanvasWidth / globalTextScale - globalTextTranslate;
    effectiveCanvasWidth = effectiveCanvasWidth < 0 ? 0 : effectiveCanvasWidth;
    for (let i = 0; i < str.length; i++) {
      if (left >= effectiveCanvasWidth) {
        left = 0;
        top += fontInfo.letterHeight;
      }
      const char = str[i];
      if (char === "\n") {
        top += fontInfo.letterHeight;
        left = 0;
        continue;
      }
      const glyphMetadata = fontInfo.glyphInfos[char];
      if (glyphMetadata) {
        let right = left + glyphMetadata.width;
        let bottom = top + fontInfo.letterHeight;
        const u1 = glyphMetadata.x / fontInfo.textureWidth;
        const u2 = (glyphMetadata.x + glyphMetadata.width - 1) / fontInfo.textureWidth;
        const v1 = glyphMetadata.y / fontInfo.textureHeight;
        const v2 = (glyphMetadata.y + fontInfo.letterHeight - 1) / fontInfo.textureHeight;
        vertices[runningVerticesIndex] = left;
        vertices[runningVerticesIndex + 1] = top;
        textureCoords[runningVerticesIndex] = u1;
        textureCoords[runningVerticesIndex + 1] = v1;
        vertices[runningVerticesIndex + 2] = left;
        vertices[runningVerticesIndex + 3] = bottom;
        textureCoords[runningVerticesIndex + 2] = u1;
        textureCoords[runningVerticesIndex + 3] = v2;
        vertices[runningVerticesIndex + 4] = right;
        vertices[runningVerticesIndex + 5] = bottom;
        textureCoords[runningVerticesIndex + 4] = u2;
        textureCoords[runningVerticesIndex + 5] = v2;
        vertices[runningVerticesIndex + 6] = left;
        vertices[runningVerticesIndex + 7] = top;
        textureCoords[runningVerticesIndex + 6] = u1;
        textureCoords[runningVerticesIndex + 7] = v1;
        vertices[runningVerticesIndex + 8] = right;
        vertices[runningVerticesIndex + 9] = top;
        textureCoords[runningVerticesIndex + 8] = u2;
        textureCoords[runningVerticesIndex + 9] = v1;
        vertices[runningVerticesIndex + 10] = right;
        vertices[runningVerticesIndex + 11] = bottom;
        textureCoords[runningVerticesIndex + 10] = u2;
        textureCoords[runningVerticesIndex + 11] = v2;
        left = right + fontInfo.spaceWidth;
        runningVerticesIndex += 12;
      } else {
        left += fontInfo.spaceWidth * 2;
      }
    }
    return { vertices, textureCoords, verticesCount: runningVerticesIndex / 2 };
  }
  function loop(time) {
    const elapsedTime = time - globalPrevTime;
    resizeCanvasToDisplaySize(gl.canvas);
    {
      gl.useProgram(globalPrograms.textProgram);
      gl.bindVertexArray(globalTextProgramData.positionVao);
      gl.uniform2f(globalTextProgramData.canvasResolutionLoc, gl.canvas.width, gl.canvas.height);
      gl.uniformMatrix3fv(globalTextProgramData.matrixLoc, false, globalMat);
      gl.uniform1i(globalTextProgramData.textureLoc, 0);
      gl.drawArrays(gl.TRIANGLES, 0, globalStrVerticesData.verticesCount);
    }
    globalPrevTime = time;
    if (globalRunning) {
      window.requestAnimationFrame(loop);
    }
  }
  function resumeWebGlSetup(e) {
    globalPrograms = createPrograms();
    globalTriangleProgramData = setupTriangleProgram(globalPrograms.triangleProgram);
    globalTextProgramData = setupTextProgram(globalPrograms.textProgram);
    gl.useProgram(globalPrograms.textProgram);
    globalTextProgramData.texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + 0);
    gl.bindTexture(gl.TEXTURE_2D, globalTextProgramData.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, globalImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.useProgram(globalPrograms.textProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.vertices, gl.STATIC_DRAW);
    const positionAttrLocation = gl.getAttribLocation(globalPrograms.textProgram, "a_position");
    globalTextProgramData.positionVao = gl.createVertexArray();
    gl.bindVertexArray(globalTextProgramData.positionVao);
    gl.enableVertexAttribArray(positionAttrLocation);
    gl.vertexAttribPointer(positionAttrLocation, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(globalPrograms.textProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.coordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.textureCoords, gl.STATIC_DRAW);
    const location = gl.getAttribLocation(globalPrograms.textProgram, "a_tex_coord");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    window.requestAnimationFrame(loop);
  }
  function main() {
    const canvas = document.createElement("CANVAS");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    document.body.appendChild(canvas);
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    globalCanvasWidth = canvas.clientWidth;
    globalCanvasHeight = canvas.clientHeight;
    if (!globalCanvasWidth)
      throw "THe canvas has no width";
    gl = canvas.getContext("webgl2");
    globalStrVerticesData = createStringVertices(globalStr, globalFontInfo);
    globalImage = new Image();
    globalImage.src = "./8x8-font.png";
    globalImage.addEventListener("load", resumeWebGlSetup);
    globalResizeObserver = new ResizeObserver(handleResize);
    globalResizeObserver.observe(gl.canvas, { box: "content-box" });
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
  }
  main();
})();
