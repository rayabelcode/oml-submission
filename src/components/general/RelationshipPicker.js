import React from 'react';
import { View, Text } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useTheme, spacing } from '../../../src/context/ThemeContext';
import { RELATIONSHIP_TYPES, RELATIONSHIP_TYPE_ARRAY } from '../../../constants/relationships';
import { useCommonStyles } from '../../../src/styles/common';

const RelationshipPicker = ({ value, onChange, showLabel = true, style = {} }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();

	const relationshipLabels = RELATIONSHIP_TYPE_ARRAY.map((type) => RELATIONSHIP_TYPES[type].label);

	return (
		<View style={style}>
			{showLabel && (
				<Text
					style={[
						commonStyles.message,
						{
							color: colors.text.primary,
							marginBottom: spacing.xs,
							fontSize: 18,
							fontWeight: 'bold',
						},
					]}
				>
					Tag the Relationship!
				</Text>
			)}
			<SegmentedControl
				values={relationshipLabels}
				selectedIndex={RELATIONSHIP_TYPE_ARRAY.indexOf(value)}
				onChange={(event) => {
					const index = event.nativeEvent.selectedSegmentIndex;
					onChange(RELATIONSHIP_TYPE_ARRAY[index]);
				}}
				tintColor={colors.primary}
				backgroundColor={colors.background.primary}
				fontStyle={{ color: colors.text.primary }}
				activeFontStyle={{ color: colors.background.primary }}
				style={{
					height: 45,
					marginBottom: spacing.xl,
				}}
			/>
		</View>
	);
};

export default RelationshipPicker;
