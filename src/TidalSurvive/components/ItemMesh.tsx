import { RoundedBox } from '@react-three/drei';
import { COLORS } from '../constants';
import type { ItemKind } from '../types';

export function ItemMesh({ kind }: { kind: ItemKind }) {
  if (kind === 'plank') {
    return (
      <group>
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
