import type { StoreAccount } from '../../domain/models/StoreAccount'
import type { AccountDto } from '../../shared/contracts/dto/AccountDto'

/** Where this machine stands with a store, as the window may see it. */
export class AccountDtoMapper {
  public toDto (account: StoreAccount): AccountDto {
    return { signInAvailable: account.signInAvailable, signedIn: account.signedIn }
  }
}
