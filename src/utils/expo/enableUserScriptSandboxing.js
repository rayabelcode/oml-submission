const { withXcodeProject } = require('@expo/config-plugins');

const modifyXcodeProject = (config) => {
	return withXcodeProject(config, (config) => {
		const { project } = config.modResults;

		// Iterate through all build configurations
		const section = project['XCBuildConfiguration'];
		for (const key in section) {
			if (section[key].buildSettings) {
				const buildSettings = section[key].buildSettings;

				// Update ENABLE_USER_SCRIPT_SANDBOXING to NO if it exists
				if (buildSettings.ENABLE_USER_SCRIPT_SANDBOXING) {
					buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
				}
			}
		}

		return config;
	});
};

module.exports = modifyXcodeProject;
