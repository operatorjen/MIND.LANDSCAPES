export const personalArtGlsl = `
  vec3 personalArt(vec3 surface, vec3 position, vec3 normal, float material) {
    if (uArtCount < 0.5 || uArtDensity <= 0.0 || material < MATERIAL_CONCRETE || material >= MATERIAL_LIMINAL_MAX || abs(normal.y) > 0.45) return surface;
    vec2 cell = floor((position.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    vec2 center = structureCenterForCell(cell);
    float ground = terrainFoundation(center);
    float variant = hash21(cell + 17.8);
    mat2 rotation = rotate2((floor(variant * 4.0) + 0.5) * 1.5707963);
    vec2 local = rotation * (position.xz - center);
    float width = mix(15.0, 23.0, hash21(cell + 4.9)) * mix(0.9, 1.18, clamp(uMechanicalIntensity * 0.55 + uStructures * 0.2, 0.0, 1.0));
    float depth = mix(28.0, 44.0, hash21(cell + 11.3)) * mix(0.9, 1.2, clamp(uRitualIntensity * 0.4 + uStructures * 0.24, 0.0, 1.0));
    float height = position.y - ground;
    bool basement = height < -0.5;
    if (abs(local.x) > width * 0.5 - 0.35 || local.y > depth * 0.5 - 0.35 || local.y < -depth * 0.78 - 1.8) return surface;
    vec2 wallNormal = rotation * normal.xz;
    bool xWall = abs(wallNormal.x) > abs(wallNormal.y);
    float along = xWall ? local.y : local.x;
    float across = xWall ? local.x : local.y;
    float wallId = floor(across * 2.0) * 3.1 + (xWall ? 71.0 : 29.0);
    float offset = hash21(cell + wallId + uSeed * 0.17) * 8.4;
    vec2 panel = vec2(floor((along + offset) / 8.4), basement ? 0.0 : floor(height / 7.0) + 1.0);
    float identity = hash21(panel + cell * 19.7 + wallId + uSeed * 0.17);
    if (identity > uArtDensity * (basement ? 0.58 : 0.24)) return surface;
    float choice = hash21(panel + identity * 37.0 + cell);
    float size = mix(3.4, 5.2, hash21(panel + identity * 53.0));
    float centerX = (panel.x + 0.5) * 8.4 - offset + (choice - 0.5) * 0.9;
    float centerY = basement ? -UNDERGROUND_DESCENT + 1.9 : (panel.y - 1.0) * 7.0 + 2.7;
    centerY += (hash21(panel + identity * 91.0) - 0.5) * 0.7;
    float turn = hash21(panel + identity * 67.0);
    float angle = turn < 0.42 ? (turn - 0.21) * 0.38
      : turn < 0.88 ? (turn - 0.65) * 3.0 : 1.5707963 + (turn - 0.94) * 2.0;
    vec2 uv = rotate2(angle) * vec2(along - centerX, height - centerY) / size;
    float rough = material >= MATERIAL_ABANDONED && material < MATERIAL_CAVE_MAX ? 1.0 : 0.35;
    float warp = (0.012 + uPsychedelicIntensity * 0.028) * (0.5 + rough);
    uv.x += sin(uv.y * 17.0 + identity * 40.0) * warp;
    uv.y += sin(uv.x * 12.0 + choice * 20.0) * warp * 0.65;
    uv += 0.5;
    if (min(uv.x, uv.y) < 0.015 || max(uv.x, uv.y) > 0.985) return surface;
    float index = floor(choice * uArtCount);
    vec2 tile = vec2(mod(index, 8.0), 3.0 - floor(index / 8.0));
    vec4 paint = texture2D(uArtAtlas, (tile + uv) / vec2(8.0, 4.0));
    paint.rgb = pow(paint.rgb, vec3(2.2));
    float gray = dot(paint.rgb, vec3(0.2126, 0.7152, 0.0722));
    paint.rgb = max(vec3(0.0), mix(vec3(gray), paint.rgb, mix(0.12, 1.55, identity) + uChromaticIntensity * 0.15));
    paint.rgb = mix(paint.rgb, paint.rgb * (0.65 + uAccentColor * 0.6), uRitualIntensity * 0.16);
    float grain = noise21(vec2(along, height) * 92.0 + cell);
    float wear = mix(0.95, smoothstep(0.08, 0.55, grain), rough * (0.22 + uAbandonedInteriors * 0.32));
    return mix(surface, paint.rgb * (0.8 + grain * 0.3), paint.a * wear * 0.94);
  }
`
