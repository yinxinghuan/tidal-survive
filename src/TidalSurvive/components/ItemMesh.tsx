import { RoundedBox } from '@react-three/drei';
import { COLORS } from '../constants';
import type { ItemKind } from '../types';

export function ItemMesh({ kind, highlight = false }: { kind: ItemKind; highlight?: boolean }) {
  // Optional gold pulse ring around tutorial-spawned items so the player's eye
  // finds them. The ring scales subtly via CSS-like sine.
  const _highlightRing = highlight ? (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
      <ringGeometry args={[0.75, 0.95, 32]} />
      <meshBasicMaterial color="#ffe17a" transparent opacity={0.65} />
    </mesh>
  ) : null;
  if (kind === 'plank') {
    return (
      <group>
        {_highlightRing}
        <RoundedBox args={[1.6, 0.18, 0.42]} radius={0.05} smoothness={3} castShadow>
          <meshStandardMaterial color={COLORS.plank} roughness={0.85} />
        </RoundedBox>
        {/* Grain lines */}
        {[-0.45, 0, 0.45].map(zo => (
          <mesh key={zo} position={[0, 0.10, zo * 0]}>
            <boxGeometry args={[1.5, 0.012, 0.018]} />
            <meshStandardMaterial color={COLORS.plankDark} roughness={0.85} />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === 'boulder') {
    return (
      <group>
        {_highlightRing}
        <mesh castShadow>
          <dodecahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color={COLORS.boulder} roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0.18, 0.18, 0.05]}>
          <dodecahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial color={COLORS.boulderShine} roughness={0.8} flatShading />
        </mesh>
      </group>
    );
  }
  // Paddle
  return (
    <group rotation={[0.6, 0, 0]}>
      {_highlightRing}
      <mesh castShadow position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.1, 12]} />
        <meshStandardMaterial color={COLORS.paddle} roughness={0.75} />
      </mesh>
      <mesh castShadow position={[0, -0.2, 0]}>
        <boxGeometry args={[0.4, 0.6, 0.06]} />
        <meshStandardMaterial color={COLORS.paddleBlade} roughness={0.7} />
      </mesh>
    </group>
  );
}
