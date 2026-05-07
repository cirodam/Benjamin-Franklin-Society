export class SocialInsuranceMember {
    readonly memberId: string;
    /** Total kin minted into the pool on behalf of this member (join + birthdays). */
    poolContributed: number = 0;
    /** Total kin paid out from the pool to this member as retirement income. */
    poolReceived: number = 0;

    constructor(memberId: string) {
        this.memberId = memberId;
    }
}
