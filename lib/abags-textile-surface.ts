type SurfaceData = { positions: number[]; normals: number[]; uvs: number[]; indices: number[] };

/** UV derivatives, in model units, for bump lighting on every textile panel. */
export function textileUvFrame(data: SurfaceData) {
  const tangent = new Float32Array(data.positions.length);
  const bitangent = new Float32Array(data.positions.length);
  const weights = new Float32Array(data.positions.length / 3);
  for (let triangle = 0; triangle < data.indices.length; triangle += 3) {
    const [a, b, c] = data.indices.slice(triangle, triangle + 3);
    const ab = [0, 1, 2].map((axis) => data.positions[b * 3 + axis] - data.positions[a * 3 + axis]);
    const ac = [0, 1, 2].map((axis) => data.positions[c * 3 + axis] - data.positions[a * 3 + axis]);
    const du1 = data.uvs[b * 2] - data.uvs[a * 2], dv1 = data.uvs[b * 2 + 1] - data.uvs[a * 2 + 1];
    const du2 = data.uvs[c * 2] - data.uvs[a * 2], dv2 = data.uvs[c * 2 + 1] - data.uvs[a * 2 + 1];
    const determinant = du1 * dv2 - du2 * dv1;
    if (Math.abs(determinant) < 1e-10) continue;
    const area = Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]);
    for (const vertex of [a, b, c]) {
      weights[vertex] += area;
      for (let axis = 0; axis < 3; axis++) {
        tangent[vertex * 3 + axis] += (ab[axis] * dv2 - ac[axis] * dv1) / determinant * area;
        bitangent[vertex * 3 + axis] += (ac[axis] * du1 - ab[axis] * du2) / determinant * area;
      }
    }
  }
  for (let vertex = 0; vertex < weights.length; vertex++) {
    const offset = vertex * 3;
    if (weights[vertex] > 1e-10) {
      for (let axis = 0; axis < 3; axis++) {
        tangent[offset + axis] /= weights[vertex];
        bitangent[offset + axis] /= weights[vertex];
      }
    } else {
      const [nx, ny, nz] = data.normals.slice(offset, offset + 3);
      const tx = Math.abs(ny) < .9 ? nz : 1, tz = Math.abs(ny) < .9 ? -nx : 0;
      tangent.set([tx, 0, tz], offset);
      bitangent.set([ny * tz, nz * tx - nx * tz, -ny * tx], offset);
    }
  }
  return { tangent, bitangent };
}

/** Inverse transpose of the model's linear part, including accessory scales. */
export function textileNormalMatrix(model: Float32Array) {
  const a = model[0], b = model[4], c = model[8];
  const d = model[1], e = model[5], f = model[9];
  const g = model[2], h = model[6], i = model[10];
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const inverse = Math.abs(determinant) > 1e-10 ? 1 / determinant : 1;
  return new Float32Array([
    (e * i - f * h) * inverse, (c * h - b * i) * inverse, (b * f - c * e) * inverse,
    (f * g - d * i) * inverse, (a * i - c * g) * inverse, (c * d - a * f) * inverse,
    (d * h - e * g) * inverse, (b * g - a * h) * inverse, (a * e - b * d) * inverse,
  ]);
}

// One height field drives displacement, cord normals and crossing occlusion.
// This is a procedural approximation of cord, not a scan of Agata's material.
export const ABAGS_CROCHET_HEIGHT_GLSL = `
float textileHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float roundedCord(float distanceToCord,float radius){
  float q=distanceToCord/radius;
  return exp(-2.4*q*q);
}
float crochetHeight(vec2 uv,float stitch){
  vec2 grid=uv*vec2(22.0,20.0);
  grid+=vec2(.055*sin(grid.y*.81),.045*sin(grid.x*.63)+.025*sin(grid.x*1.79));
  grid.x+=mod(floor(grid.y),2.0)*.5;
  vec2 cell=floor(grid),p=fract(grid);
  float variation=textileHash(cell);
  p.x+=(variation-.5)*.055*sin(p.x*3.14159);
  float radius=.135+(variation-.5)*.018;
  float height;
  if(stitch<.5){
    // 5 mm polyester cord: interlocking V legs and a recessed return loop.
    float legY=.17+1.24*abs(p.x-.5);
    float legs=roundedCord(abs(p.y-legY)/1.59,radius);
    float returnY=.80+.11*cos((p.x-.5)*6.28318);
    float returnLoop=roundedCord(abs(p.y-returnY),radius*.82);
    height=max(legs,returnLoop*.66);
  }else if(stitch<1.5){
    // Herringbone: slanted, crossing pairs of cord, with staggered rows.
    float chevron=abs(fract(p.y+abs(p.x-.5)*1.15)-.48)/1.52;
    float companion=abs(fract(p.y+abs(p.x-.5)*1.15+.23)-.48)/1.52;
    height=max(roundedCord(chevron,radius),roundedCord(companion,radius*.75)*.72);
  }else if(stitch<2.5){
    // Basket stitch: alternating over/under bundles, with gaps at crossings.
    float over=mod(cell.x+cell.y,2.0);
    float warp=roundedCord(abs(p.x-.5),.28)*(1.0-.22*sin(p.y*3.14159));
    float weft=roundedCord(abs(p.y-.5),.28)*(1.0-.22*sin(p.x*3.14159));
    height=max(warp*mix(.65,1.0,over),weft*mix(1.0,.65,over));
  }else{
    // Shell stitch: scalloped fans with three soft, radiating ribs.
    vec2 fan=(p-vec2(.5,.14))*vec2(1.0,.88);
    float arc=roundedCord(abs(length(fan)-.52),radius);
    float ribs=pow(max(0.0,cos(atan(fan.y,fan.x)*6.0)),8.0)*smoothstep(.04,.25,fan.y);
    height=max(arc,ribs*.72);
  }
  float twist=.965+.035*sin((p.x*.8+p.y)*39.0+variation*6.28318);
  return clamp(height*twist*(.96+.04*variation),0.0,1.0);
}
`;
