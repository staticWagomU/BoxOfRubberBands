declare module "virtual:git-dates" {
	const gitDates: Record<
		string,
		{
			createdDate: string | null;
			updatedDate: string | null;
		}
	>;
	export default gitDates;
}
