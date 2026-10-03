import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { CLASSIFICATION_META, HIGHLIGHTED, ReviewMove, whiteShare } from "../../lib/analysis";
import { T } from "../ui/theme";

type Props = {
    moves: Pick<ReviewMove, "evalCp" | "mate" | "mateFor" | "classification">[];
    /** 0 = start position, i = after move i. */
    currentIndex: number;
    onSelect?: (index: number) => void;
    width: number;
    height?: number;
    /** Number of half-moves the finished graph will have (for a graph that is still filling up). */
    totalPlies?: number;
};

// Evaluation over the whole game: the light area is White's share. Dots mark
// the moves that decided the game. Tap anywhere to jump to that move.
export default function EvalGraph({ moves, currentIndex, onSelect, width, height = 92, totalPlies }: Props) {
    const total = Math.max(totalPlies ?? moves.length, 1);

    const { area, line, points } = useMemo(() => {
        const step = total > 1 ? width / total : width;
        const pts = [{ x: 0, y: height / 2 }];

        moves.forEach((move, index) => {
            pts.push({ x: (index + 1) * step, y: (1 - whiteShare(move)) * height });
        });

        const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        const last = pts[pts.length - 1];

        return {
            points: pts,
            line: linePath,
            area: `${linePath} L${last.x.toFixed(1)} ${height} L0 ${height} Z`,
        };
    }, [moves, total, width, height]);

    const cursor = points[Math.min(currentIndex, points.length - 1)];

    return (
        <View style={{ width, height, borderRadius: 10, overflow: "hidden" }}>
            <Svg width={width} height={height}>
                <Rect x={0} y={0} width={width} height={height} fill="#262B34" />
                <Path d={area} fill="#E9ECEF" />
                <Path d={line} stroke="rgba(11,13,17,0.35)" strokeWidth={1} fill="none" />
                <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(128,134,144,0.55)" strokeWidth={1} strokeDasharray="3 4" />

                {moves.map((move, index) =>
                    HIGHLIGHTED.includes(move.classification) && move.classification !== "inaccuracy" ? (
                        <Circle
                            key={index}
                            cx={points[index + 1].x}
                            cy={Math.max(5, Math.min(height - 5, points[index + 1].y))}
                            r={3.6}
                            fill={CLASSIFICATION_META[move.classification].color}
                            stroke="#0B0D11"
                            strokeWidth={1}
                        />
                    ) : null
                )}

                {cursor && (
                    <>
                        <Line x1={cursor.x} y1={0} x2={cursor.x} y2={height} stroke={T.accent} strokeWidth={1.5} />
                        <Circle cx={cursor.x} cy={Math.max(5, Math.min(height - 5, cursor.y))} r={4.5} fill={T.accent} stroke="#FFFFFF" strokeWidth={1.5} />
                    </>
                )}
            </Svg>

            {onSelect && (
                <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
                    {moves.map((_, index) => (
                        <Pressable key={index} style={{ flex: 1 }} onPress={() => onSelect(index + 1)} />
                    ))}
                </View>
            )}
        </View>
    );
}
