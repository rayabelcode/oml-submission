import React from 'react';
import { View, Text } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useTheme, spacing } from '../../../src/context/ThemeContext';
import { RELATIONSHIP_TYPES } from '../../../constants/relationships';
import { useCommonStyles } from '../../../src/styles/common';

const RelationshipPicker = ({ value, onChange, showLabel = true, style = {} }) => {
	const { colors } = useTheme();
	const commonStyles = useCommonStyles();

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
				values={RELATIONSHIP_TYPES.map((type) => type.charAt(0).toUpperCase() + type.slice(1))}
				selectedIndex={RELATIONSHIP_TYPES.indexOf(value)}
				onChange={(event) => {
					const index = event.nativeEvent.selectedSegmentIndex;
					onChange(RELATIONSHIP_TYPES[index]);
				}}
				tintColor={colors.primary}
				backgroundColor={colors.background.primary}
				style={{
					height: 45,
					marginBottom: spacing.xl,
				}}
			/>
		</View>
	);
};

export default RelationshipPicker;
