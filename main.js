(() => {
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
  var globalRunning = true;
  var globalPrevTime = 0;
  var globalResizeObserver;
  var globalNeedResize = false;
  var globalCanvasWidth = 0;
  var globalCanvasHeight = 0;
  var globalInputs = {};
  var gl;
  var globalCanvasResolutionLocation;
  var globalTranslationMatrixLocation;
  var globalTransformationMatrix = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1
  ];
  var globalRunningAngle = 0;
  function createShaderProgram() {
    const vertexSrc = `#version 300 es
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
    const fragmentSrc = `#version 300 es
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
    const vertexShader = webGlCreateShader(gl, gl.VERTEX_SHADER, vertexSrc);
    const fragmentShader = webGlCreateShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
    const program = webglCreateProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);
    globalCanvasResolutionLocation = gl.getUniformLocation(program, "u_canvas_resolution");
    globalTranslationMatrixLocation = gl.getUniformLocation(program, "u_translation_mat");
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
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
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttrLocation);
    const size = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.vertexAttribPointer(positionAttrLocation, size, type, normalize, stride, offset);
  }
  function resizeCanvasToDisplaySize(canvas) {
    if (globalNeedResize) {
      canvas.width = globalCanvasWidth;
      canvas.height = globalCanvasHeight;
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
    globalInputs[e.key] = true;
  }
  function handleKeyUp(e) {
    globalInputs[e.key] = false;
  }
  function handleUnload() {
    globalResizeObserver.disconnect();
  }
  function loop(time) {
    const elapsedTime = time - globalPrevTime;
    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    globalRunningAngle += elapsedTime / 1e4 % (Math.PI * 2);
    const c = Math.cos(globalRunningAngle * Math.PI);
    const s = Math.sin(globalRunningAngle * Math.PI);
    globalTransformationMatrix[0] = c;
    globalTransformationMatrix[1] = -s;
    globalTransformationMatrix[3] = s;
    globalTransformationMatrix[4] = c;
    gl.uniform2f(globalCanvasResolutionLocation, gl.canvas.width, gl.canvas.height);
    gl.uniformMatrix3fv(globalTranslationMatrixLocation, false, globalTransformationMatrix);
    const primitiveType = gl.TRIANGLES;
    const offset = 0;
    const count = 6;
    gl.drawArrays(primitiveType, offset, count);
    globalPrevTime = time;
    if (globalRunning) {
      window.requestAnimationFrame(loop);
    }
  }
  function main() {
    const canvas = document.createElement("CANVAS");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    document.body.appendChild(canvas);
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl = canvas.getContext("webgl2");
    globalResizeObserver = new ResizeObserver(handleResize);
    globalResizeObserver.observe(gl.canvas, { box: "content-box" });
    window.addEventListener("beforeunload", handleUnload);
    createShaderProgram();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.requestAnimationFrame(loop);
  }
  main();
})();
